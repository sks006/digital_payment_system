// programs/lending_vault/src/instructions/borrow.rs
//
// UPGRADED borrow instruction that actually moves tokens.
//
// What changed vs the original:
//   - Added eurc_mint, user_eurc_account, associated_token_program to accounts
//   - The vault PDA is the EURC mint authority (set during initialize)
//   - After the health-factor check, we MINT eurc to the user's ATA via CPI
//   - Fixed precision bug in the collateral-to-EUR calculation
//   - Use ltv_threshold for new borrows (stricter than liquidation_threshold)

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};
use crate::state::{Vault, UserPosition};
use crate::error::ErrorCode;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, get_feed_id_from_hex};

// Hardcoded Pyth feed IDs (matches what initialize.rs pins to the vault config)
const SOL_USD_FEED_ID_HEX: &str =
    "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const EUR_USD_FEED_ID_HEX: &str =
    "a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b";

#[derive(Accounts)]
pub struct Borrow<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"user_position", user.key().as_ref()],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// The EURC mint. Must have `vault` PDA as its mint authority — this is set
    /// during initialize. On mainnet you'd swap this for a transfer-from-reserve
    /// model since Circle controls the real EURC mint authority.
    #[account(
        mut,
        constraint = eurc_mint.key() == vault.eurc_mint @ ErrorCode::InvalidEurcMint,
    )]
    pub eurc_mint: Account<'info, Mint>,

    /// User's EURC associated token account. Created on first borrow if missing.
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = eurc_mint,
        associated_token::authority = user,
    )]
    pub user_eurc_account: Account<'info, TokenAccount>,

    /// Pyth SOL/USD price feed (PriceUpdateV2 pull-oracle account)
    pub sol_price_update: Account<'info, PriceUpdateV2>,

    /// Pyth EUR/USD price feed (for EURC valuation)
    pub eur_price_update: Account<'info, PriceUpdateV2>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    // ---------- 1. Read live prices from Pyth ----------
    let sol_feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID_HEX)
        .map_err(|_| ErrorCode::InvalidOracleAccount)?;
    let eur_feed_id = get_feed_id_from_hex(EUR_USD_FEED_ID_HEX)
        .map_err(|_| ErrorCode::InvalidOracleAccount)?;

    let max_age = ctx.accounts.vault.max_price_age as u64;
    let clock = Clock::get()?;

    let sol_price = ctx.accounts.sol_price_update
        .get_price_no_older_than(&clock, max_age, &sol_feed_id)
        .map_err(|_| ErrorCode::StaleOraclePrice)?;
    let eur_price = ctx.accounts.eur_price_update
        .get_price_no_older_than(&clock, max_age, &eur_feed_id)
        .map_err(|_| ErrorCode::StaleOraclePrice)?;

    require!(sol_price.price > 0, ErrorCode::InvalidOracleAccount);
    require!(eur_price.price > 0, ErrorCode::InvalidOracleAccount);

    // ---------- 2. Compute collateral value in EUR (6 decimals) ----------
    // Goal: collateral_value_eur_micro = (deposited_lamports * sol_usd / eur_usd) scaled to 6 decimals.
    //
    // Pyth prices are signed integers with an exponent. The actual price is
    // raw_price * 10^expo (expo is typically negative, e.g. -8).
    //
    // Multiplying first preserves precision; dividing first truncates and
    // small deposits can round to zero.
    let sol_price_raw = sol_price.price as u128;          // > 0 by check above
    let eur_price_raw = eur_price.price as u128;
    let sol_expo = sol_price.exponent.unsigned_abs() as u32;
    let eur_expo = eur_price.exponent.unsigned_abs() as u32;

    // SOL is in lamports (9 decimals), EURC target is 6 decimals.
    // Final scale factor adjustment = 10^(eur_expo + 6) / 10^(sol_expo + 9)
    let deposited = ctx.accounts.user_position.deposited_amount as u128;

    // Step 1: numerator = deposited * sol_price_raw * 10^eur_expo * 10^6
    let numerator = deposited
        .checked_mul(sol_price_raw).ok_or(ErrorCode::MathOverflow)?
        .checked_mul(10u128.pow(eur_expo)).ok_or(ErrorCode::MathOverflow)?
        .checked_mul(1_000_000u128).ok_or(ErrorCode::MathOverflow)?;

    // Step 2: denominator = eur_price_raw * 10^sol_expo * 10^9 (lamport scale)
    let denominator = eur_price_raw
        .checked_mul(10u128.pow(sol_expo)).ok_or(ErrorCode::MathOverflow)?
        .checked_mul(1_000_000_000u128).ok_or(ErrorCode::MathOverflow)?;

    let collateral_value_eur_micro = numerator
        .checked_div(denominator)
        .ok_or(ErrorCode::MathOverflow)?;

    // ---------- 3. New-borrow check uses the LTV threshold (strict) ----------
    let new_debt = (ctx.accounts.user_position.borrowed_amount as u128)
        .checked_add(amount as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let max_borrow_micro = collateral_value_eur_micro
        .checked_mul(ctx.accounts.vault.ltv_threshold as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100u128)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(new_debt <= max_borrow_micro, ErrorCode::HealthFactorTooLow);

    // ---------- 4. Mint EURC to the user's ATA, signed by the vault PDA ----------
    let vault_bump = ctx.accounts.vault.bump;
    let signer_seeds: &[&[u8]] = &[b"vault", &[vault_bump]];
    let signers = &[signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.eurc_mint.to_account_info(),
            to: ctx.accounts.user_eurc_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signers,
    );
    token::mint_to(cpi_ctx, amount)?;

    // ---------- 5. Update on-chain accounting ----------
    let user_position = &mut ctx.accounts.user_position;
    let vault = &mut ctx.accounts.vault;

    user_position.borrowed_amount = user_position
        .borrowed_amount
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    user_position.last_updated = clock.unix_timestamp;

    vault.total_borrowed = vault
        .total_borrowed
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    // Compute current health factor for the log message
    let current_hf = if user_position.borrowed_amount == 0 {
        9999u128
    } else {
        collateral_value_eur_micro
            .checked_mul(100)
            .unwrap_or(u128::MAX)
            .checked_div(user_position.borrowed_amount as u128)
            .unwrap_or(0)
    };

    msg!(
        "Borrow OK: minted {} EURC to user. New debt: {}. HF (basis points): {}",
        amount,
        user_position.borrowed_amount,
        current_hf
    );

    Ok(())
}
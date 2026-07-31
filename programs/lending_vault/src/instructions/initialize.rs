// programs/lending_vault/src/instructions/initialize.rs
//
// UPGRADED initialize instruction.
//
// What changed vs the original:
//   - Creates the EURC mint and sets the vault PDA as its mint authority
//   - Stores eurc_mint in the Vault state so other instructions can validate it
//   - Keeps the wSOL collateral vault (vault_token_account) unchanged
//
// Run this ONCE per program deployment. After this, the vault PDA can mint
// EURC into any user's ATA via the borrow instruction.
//
// IMPORTANT: This creates a CUSTOM EURC-like mint that you control. For the
// investor demo this is what you want — Circle's faucet only gives 10 EURC
// at a time and you'd run out. The token has the same decimals (6) as real
// EURC, the UI labels it "EURC", and investors see real SPL token movements.
// For mainnet, replace the mint-to model with transfer-from-reserve.

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::Vault;
use crate::error::ErrorCode;

pub const ADMIN_PUBKEY: Pubkey = pubkey!("Dtur175PvRNiR1HESsZwUi3NcS8j2GdY3WrwfQ4m5TYL");

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        mut , 
        address = ADMIN_PUBKEY @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    /// wSOL collateral vault (unchanged from before)
    #[account(
        init,
        payer = authority,
        seeds = [b"vault_token_account"],
        bump,
        token::mint = wsol_mint,
        token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// wSOL mint — caller passes the canonical wSOL mint address.
    pub wsol_mint: Account<'info, Mint>,

    /// NEW: EURC-like mint, owned by the vault PDA.
    /// Created here with 6 decimals to match real EURC. Vault is mint authority.
    #[account(
        init,
        payer = authority,
        seeds = [b"eurc_mint"],
        bump,
        mint::decimals = 6,
        mint::authority = vault,
    )]
    pub eurc_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    vault.authority = ctx.accounts.authority.key();
    vault.eurc_mint = ctx.accounts.eurc_mint.key();      // NEW

    // Pyth Devnet feeds — same as before
    vault.sol_price_feed = pubkey!("J83w4HKmR1QCoo3Cq77znf9DXYH1Fp8pJK3u78d2b7X6");
    vault.eur_price_feed = pubkey!("79N7bpkPu397S8Zg5m8GjGkzJ4xWpTpxkS76mCqKqySj");

    vault.max_price_age = 120;            // 2 minutes
    vault.ltv_threshold = 80;             // 80% LTV (new borrows must stay under this)
    vault.liquidation_threshold = 120;    // 1.2x health factor
    vault.total_collateral = 0;
    vault.total_shares = 0;
    vault.total_borrowed = 0;
    vault.total_borrowed_shares = 0;
    vault.bump = ctx.bumps.vault;

    msg!(
        "Vault initialized. Authority: {}. EURC mint: {}.",
        vault.authority,
        vault.eurc_mint
    );
    Ok(())
}
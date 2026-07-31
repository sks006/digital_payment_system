use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Token, TokenAccount };
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, get_feed_id_from_hex};

use crate::state::{ Vault, UserPosition };
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,

    #[account(mut)]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    pub sol_price_update: Account<'info, PriceUpdateV2>,
    pub eur_price_update: Account<'info, PriceUpdateV2>,

    #[account(mut)]
    pub liquidator_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn liquidate(ctx: Context<Liquidate>, repay_amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let user_position = &mut ctx.accounts.user_position;

    require!(repay_amount > 0, ErrorCode::InvalidAmount);
    require!(user_position.borrowed_amount > 0, ErrorCode::NoDebt);

    // Calculate current Health Factor using Pyth prices
    let health_factor = calculate_health_factor(
        user_position,
        vault,
        &ctx.accounts.sol_price_update,
        &ctx.accounts.eur_price_update,
        ctx.accounts.clock.unix_timestamp
    )?;

    // Liquidation only allowed if Health Factor < 1.0 (or your chosen threshold)
    require!(health_factor < 1_000_000, ErrorCode::PositionHealthy); // 1.0 = 1_000_000

    // Cap repayment at 50% of debt per liquidation
    let max_repay = user_position.borrowed_amount / 2;
    let actual_repay = repay_amount.min(max_repay);

    // Calculate shares to repay
    let _shares_to_repay = if vault.total_collateral == 0 {
        0u64
    } else {
        u128
            ::from(actual_repay)
            .checked_mul(vault.total_shares as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(vault.total_collateral as u128)
            .ok_or(ErrorCode::MathOverflow)? as u64
    };

    // Update user position
    user_position.borrowed_amount = user_position.borrowed_amount
        .checked_sub(actual_repay)
        .ok_or(ErrorCode::MathOverflow)?;

    // Update vault
    vault.total_collateral = vault.total_collateral
        .checked_sub(actual_repay)
        .ok_or(ErrorCode::MathOverflow)?;

    // === FIXED: Collateral with Bonus (8% example) ===
    let bonus_rate = 108u64; // Change to 105 for 5%, 110 for 10%, etc.

    let collateral_to_seize = u128
        ::from(actual_repay)
        .checked_mul(bonus_rate as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    // Transfer collateral to liquidator
    let cpi_accounts = token::Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.liquidator_token_account.to_account_info(),
        authority: ctx.accounts.vault.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, collateral_to_seize)?;

    emit!(LiquidateEvent {
        liquidator: ctx.accounts.liquidator.key(),
        user: user_position.owner,
        repay_amount: actual_repay,
        collateral_seized: collateral_to_seize,
        health_factor_before: health_factor,
        bonus_applied: bonus_rate,
    });

    Ok(())
}

// Improved Health Factor with Pyth (same as before)
pub fn calculate_health_factor(
    user_position: &UserPosition,
    vault: &Vault,
    sol_price_update: &Account<PriceUpdateV2>,
    eur_price_update: &Account<PriceUpdateV2>,
    _current_timestamp: i64
) -> Result<u64> {
    let sol_feed_id = get_feed_id_from_hex("ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d")
        .map_err(|_| ErrorCode::InvalidOracleAccount)?;
    let eur_feed_id = get_feed_id_from_hex("a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b")
        .map_err(|_| ErrorCode::InvalidOracleAccount)?;

    let sol_price = sol_price_update
        .get_price_no_older_than(&Clock::get()?, vault.max_price_age as u64, &sol_feed_id)
        .map_err(|_| ErrorCode::StaleOraclePrice)?;

    let eur_price = eur_price_update
        .get_price_no_older_than(&Clock::get()?, vault.max_price_age as u64, &eur_feed_id)
        .map_err(|_| ErrorCode::StaleOraclePrice)?;

    let collateral_value_eur = u128
        ::from(user_position.deposited_amount)
        .checked_mul(sol_price.price as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div((10u128).pow(sol_price.exponent.unsigned_abs()))
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(eur_price.price as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let debt_value_eur = user_position.borrowed_amount as u128;

    if debt_value_eur == 0 {
        return Ok(9_999_999);
    }

    let health_factor = (collateral_value_eur * 1_000_000) / debt_value_eur;
    Ok(health_factor as u64)
}

#[event]
pub struct LiquidateEvent {
    pub liquidator: Pubkey,
    pub user: Pubkey,
    pub repay_amount: u64,
    pub collateral_seized: u64,
    pub health_factor_before: u64,
    pub bonus_applied: u64,
}

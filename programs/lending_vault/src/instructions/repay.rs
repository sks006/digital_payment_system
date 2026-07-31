// programs/lending_vault/src/instructions/repay.rs
//
// UPGRADED repay instruction.
//
// What changed vs the original:
//   - Burns EURC from the user's ATA (instead of trying to token::transfer
//     it into vault_token_account, which holds wSOL — that was a mint mismatch
//     bug that would always fail at runtime).
//   - Added eurc_mint to the accounts struct.
//   - Removed the bogus vault.total_collateral decrement (repaying debt
//     doesn't reduce collateral; that was a logic bug in the original).

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::state::{Vault, UserPosition};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Repay<'info> {
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
        constraint = user_position.owner == user.key() @ ErrorCode::InvalidOwner,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// Same EURC mint registered in the vault config.
    #[account(
        mut,
       constraint = eurc_mint.key() == vault.eurc_mint @ ErrorCode::InvalidEurcMint,
    )]
    pub eurc_mint: Account<'info, Mint>,

    /// User's EURC ATA — the source of the burn.
    #[account(
        mut,
        token::mint = eurc_mint,
        token::authority = user,
    )]
    pub user_eurc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn repay(ctx: Context<Repay>, repay_amount: u64) -> Result<()> {
    require!(repay_amount > 0, ErrorCode::InvalidAmount);
    require!(
        ctx.accounts.user_position.borrowed_amount > 0,
        ErrorCode::NoDebt
    );

    // Cap the repayment at the outstanding debt
    let actual_repay = repay_amount.min(ctx.accounts.user_position.borrowed_amount);

    // Burn EURC from the user's ATA. The user signs the burn directly because
    // they own the ATA — no PDA signer needed here.
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.eurc_mint.to_account_info(),
            from: ctx.accounts.user_eurc_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::burn(cpi_ctx, actual_repay)?;

    // Update on-chain accounting
    let user_position = &mut ctx.accounts.user_position;
    let vault = &mut ctx.accounts.vault;

    user_position.borrowed_amount = user_position
        .borrowed_amount
        .checked_sub(actual_repay)
        .ok_or(ErrorCode::MathOverflow)?;
    user_position.last_updated = ctx.accounts.clock.unix_timestamp;

    vault.total_borrowed = vault
        .total_borrowed
        .checked_sub(actual_repay)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(RepayEvent {
        user: ctx.accounts.user.key(),
        repay_amount: actual_repay,
        remaining_borrowed: user_position.borrowed_amount,
    });

    msg!("Repay OK: burned {} EURC. Remaining debt: {}", actual_repay, user_position.borrowed_amount);

    Ok(())
}

#[event]
pub struct RepayEvent {
    pub user: Pubkey,
    pub repay_amount: u64,
    pub remaining_borrowed: u64,
}
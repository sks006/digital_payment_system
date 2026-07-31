use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use crate::state::{Vault, UserPosition};
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// Global vault - must already be initialized
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    /// User position - create if it doesn't exist (first deposit)
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserPosition::INIT_SPACE,   // Use InitSpace macro - much safer
        seeds = [b"user_position", user.key().as_ref()],
        bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// User's SOL token account (they must approve transfer)
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Vault's SOL token account (where collateral is held)
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    // Basic validation
    require!(amount > 0, ErrorCode::InvalidAmount);

    let user_position = &mut ctx.accounts.user_position;
    let vault = &mut ctx.accounts.vault;

    // === Transfer SOL from user to vault ===
    let cpi_accounts = token::Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );
    token::transfer(cpi_ctx, amount)?;

    // === Update User Position ===
    if user_position.owner == Pubkey::default() {
        // First time deposit
        user_position.owner = ctx.accounts.user.key();
        user_position.deposited_amount = amount;
        user_position.borrowed_amount = 0;
        user_position.shares = amount;           // 1:1 for MVP
        user_position.last_updated = ctx.accounts.clock.unix_timestamp;
        user_position.bump = ctx.bumps.user_position;
    } else {
        // Additional deposit
        user_position.deposited_amount = user_position.deposited_amount
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        user_position.shares = user_position.shares
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        user_position.last_updated = ctx.accounts.clock.unix_timestamp;
    }

    // === Update Global Vault ===
    vault.total_collateral = vault.total_collateral
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    vault.total_shares = vault.total_shares
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!("Deposit successful: {} lamports by {}", amount, ctx.accounts.user.key());

    Ok(())
}
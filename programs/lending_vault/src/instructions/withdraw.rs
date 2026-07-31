use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Token, TokenAccount };
use crate::state::{ Vault, UserPosition };
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Withdraw<'info> {
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

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let user_key = ctx.accounts.user.key();
    let vault_bump = ctx.accounts.vault.bump;

    let user_position = &mut ctx.accounts.user_position;

    require!(user_position.owner == user_key, ErrorCode::Unauthorized);
    require!(user_position.deposited_amount >= amount, ErrorCode::InsufficientCollateral);

    // Transfer with PDA signer
    let bump = &[vault_bump];
    let seeds = &[b"vault".as_ref(), bump];
    let signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer
    );

    token::transfer(cpi_ctx, amount)?;

    let vault = &mut ctx.accounts.vault;

    // Update balances
    user_position.deposited_amount = user_position.deposited_amount
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    user_position.shares = user_position.shares
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    user_position.last_updated = ctx.accounts.clock.unix_timestamp;

    vault.total_collateral = vault.total_collateral
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    vault.total_shares = vault.total_shares
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!("Withdraw successful: {} lamports", amount);
    Ok(())
}

use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Vault {
    /// Founder/admin authority — can update config later
    pub authority: Pubkey,
 
    /// EURC-like SPL mint that this vault is the authority of.
    /// borrow.rs mints from this; repay.rs burns into this.
    pub eurc_mint: Pubkey,
 
    /// Total SOL deposited (lamports)
    pub total_collateral: u64,
    /// Total vault shares issued
    pub total_shares: u64,
    /// Total EURC borrowed (micro-units)
    pub total_borrowed: u64,
    /// Total borrowed shares
    pub total_borrowed_shares: u64,
 
    /// Pyth SOL/USD price feed account
    pub sol_price_feed: Pubkey,
    /// Pyth EUR/USD price feed account
    pub eur_price_feed: Pubkey,
 
    /// Max price age in seconds (anti-stale)
    pub max_price_age: i64,
 
    /// LTV percentage — used by borrow (e.g. 80 = 80%)
    pub ltv_threshold: u8,
    /// Liquidation health-factor percentage (e.g. 120 = 1.2x)
    pub liquidation_threshold: u8,
 
    /// PDA bump
    pub bump: u8,
}


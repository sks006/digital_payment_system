use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserPosition {
    //user authority
    pub authority: Pubkey,
    /// Owner of this position (user's wallet)
    pub owner: Pubkey,

    /// How much SOL this user has deposited (in lamports)
    pub deposited_amount: u64,

    /// How much the user has "spent" / borrowed (in lamports equivalent)
    pub borrowed_amount: u64,

    /// How many vault shares the user owns (for yield)
    pub shares: u64,

    /// Last time this position was updated (for yield accrual)
    pub last_updated: i64,

    /// How many shares of the borrowed amount this user has (for proportional repayments)
    pub borrowed_shares: u64,

    /// PDA bump seed
    pub bump: u8,
}

impl UserPosition {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 8 + 1;
}
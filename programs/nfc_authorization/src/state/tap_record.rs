use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TapRecord {
    pub amount: u64,
    #[max_len(64)]
    pub nonce: String,
    pub timestamp: i64,
}

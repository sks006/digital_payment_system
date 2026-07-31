use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct NfcDevice {
    pub authority: Pubkey,
    #[max_len(32)]
    pub device_id: String,
    pub is_active: bool,
}

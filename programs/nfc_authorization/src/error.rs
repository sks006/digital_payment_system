use anchor_lang::prelude::*;

#[error_code]
pub enum NfcError {
    #[msg("Device not registered")]
    DeviceNotRegistered,
    #[msg("Invalid nonce")]
    InvalidNonce,
}

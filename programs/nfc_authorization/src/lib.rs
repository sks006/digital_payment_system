use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod error;

use instructions::*;

declare_id!("BLAybZY5URNEhMvNGjdvwPPVNpvz7MqeNXC9R4YdL6Wc");

#[program]
pub mod nfc_authorization {
    use super::*;

    use crate::instructions::register_device::RegisterDevice;
    use crate::instructions::authorize_tap::AuthorizeTap;
    use crate::instructions::revoke_device::RevokeDevice;

    pub fn register_device(ctx: Context<RegisterDevice>, device_id: String) -> Result<()> {
        instructions::register_device::register_device(ctx, device_id)
    }

    pub fn authorize_tap(ctx: Context<AuthorizeTap>, amount: u64, nonce: String) -> Result<()> {
        instructions::authorize_tap::authorize_tap(ctx, amount, nonce)
    }

    pub fn revoke_device(ctx: Context<RevokeDevice>) -> Result<()> {
        instructions::revoke_device::revoke_device(ctx)
    }
}

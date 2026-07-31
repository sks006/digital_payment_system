use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RevokeDevice<'info> {
    pub user: Signer<'info>,
}

pub fn revoke_device(_ctx: Context<RevokeDevice>) -> Result<()> {
    Ok(())
}

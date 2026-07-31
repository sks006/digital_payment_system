use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AuthorizeTap<'info> {
    pub user: Signer<'info>,
}

pub fn authorize_tap(_ctx: Context<AuthorizeTap>, _amount: u64, _nonce: String) -> Result<()> {
    Ok(())
}

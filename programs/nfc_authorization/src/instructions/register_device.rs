use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RegisterDevice<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn register_device(_ctx: Context<RegisterDevice>, _device_id: String) -> Result<()> {
    Ok(())
}

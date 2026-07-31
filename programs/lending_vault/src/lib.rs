use anchor_lang::prelude::*;

declare_id!("2oyU8LCEPCicz6AN2emJw2BTZe8eU73CU5AJGhAEpcZz");

// Modules
pub mod state;
pub mod error;
pub mod instructions;

use instructions::*;

#[program]
pub mod lending_vault {
    use super::*;

    // Import the handler functions with different names to avoid conflict
    use crate::instructions::initialize::initialize as initialize_handler;
    use crate::instructions::deposit::deposit as deposit_handler;
    use crate::instructions::withdraw::withdraw as withdraw_handler;
    use crate::instructions::borrow::borrow as borrow_handler;
    use crate::instructions::repay::repay as repay_handler;
    use crate::instructions::liquidate::liquidate as liquidate_handler;

    // ==================== PROGRAM INSTRUCTIONS ====================

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize_handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        deposit_handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        withdraw_handler(ctx, amount)
    }

    pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
        borrow_handler(ctx, amount)
    }

    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        repay_handler(ctx, amount)
    }

    pub fn liquidate(ctx: Context<Liquidate>, repay_amount: u64) -> Result<()> {
        liquidate_handler(ctx, repay_amount)
    }
}
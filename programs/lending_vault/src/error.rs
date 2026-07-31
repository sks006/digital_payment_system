use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient collateral")]
    InsufficientCollateral,

    #[msg("Health factor too low")]
    HealthFactorTooLow,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Invalid oracle account")]
    InvalidOracleAccount,

    #[msg("Stale oracle price - price is too old")]
    StaleOraclePrice,

    #[msg("Oracle confidence interval too wide")]
    OracleConfidenceTooWide,

    #[msg("Unauthorized - only vault authority can perform this action")]
    Unauthorized,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Insufficient liquidity in vault")]
    InsufficientLiquidity,

    #[msg("Position not found")]
    PositionNotFound,

    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("No outstanding debt to repay")]
    NoDebt,
    #[msg("Invalid owner for this position")]
    InvalidOwner,
    #[msg("Position is healthy and cannot be liquidated")]
    PositionHealthy,
    #[msg("Invalid EURC mint - does not match vault's registered mint")]
    InvalidEurcMint,
    
}



// programs/lending_vault/src/state/mod.rs
pub mod vault;           // declares the submodule
pub mod user_position;

// Re-export the structs so `crate::state::Vault` works everywhere
pub use vault::Vault;
pub use user_position::UserPosition;

// If you have more state structs later, add them here
// pub use other::Something;
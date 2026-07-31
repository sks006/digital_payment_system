// backend/src/state/memory_store.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

// Simple in-memory storage for MVP
#[derive(Default)]
pub struct AppState {
    // User sessions / positions (wallet address -> some data)
    pub users: HashMap<String, UserSession>,

    // NFC taps log (for demo)
    pub nfc_taps: HashMap<String, Vec<NfcTapRecord>>,

    // Nonce store for security
    pub nonce_store: NonceStore,
}

impl AppState {
    pub fn new() -> Self {
        Self::default()
    }
}

// Simple user session
#[derive(Clone)]
pub struct UserSession {
    pub wallet_address: String,
    pub last_activity: i64,        // unix timestamp
    pub current_health_factor: f64,
}

// Record of an NFC tap
#[derive(Clone)]
pub struct NfcTapRecord {
    pub timestamp: i64,
    pub amount: u64,
    pub receipt_id: String,
}

// Simple nonce store (prevents replay attacks)
#[derive(Default)]
pub struct NonceStore {
    nonces: HashMap<String, i64>,   // nonce -> expiry timestamp
}

impl NonceStore {
    pub fn generate_nonce(&mut self) -> String {
        let nonce = Uuid::new_v4().to_string();
        let expiry = chrono::Utc::now().timestamp() + 300; // 5 minutes valid
        self.nonces.insert(nonce.clone(), expiry);
        nonce
    }

    pub fn verify_and_consume_nonce(&mut self, nonce: &str) -> bool {
        if let Some(expiry) = self.nonces.get(nonce) {
            if *expiry > chrono::Utc::now().timestamp() {
                self.nonces.remove(nonce);
                return true;
            }
        }
        false
    }

    pub fn sweep_expired(&mut self) {
        let now = chrono::Utc::now().timestamp();
        self.nonces.retain(|_, &mut expiry| expiry > now);
    }
}

// For easy access in handlers
pub type SharedState = Arc<Mutex<AppState>>;
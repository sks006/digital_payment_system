// backend/src/main.rs
//
// This is the entry point of the backend server.
// It starts the Axum web server and registers all routes.

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};

mod handlers;
mod state;



use handlers::health;
use handlers::nfc;        // We are using NFC handlers now

#[tokio::main]
async fn main() {
    // Initialize logging so we can see messages in terminal
    tracing_subscriber::fmt::init();

    // Create shared application state (in-memory storage)
    let app_state = Arc::new(Mutex::new(state::memory_store::AppState::new()));

    // Background task: clean expired nonces every 2 minutes
    {
        let state = app_state.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(120));
            loop {
                interval.tick().await;
                let mut guard = state.lock().await;
                guard.nonce_store.sweep_expired();
            }
        });
    }

    // CORS settings - allows frontend to call backend
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Define all routes
    let app = Router::new()
        // Health check
        .route("/", get("hello from crypto-fiat-bridge"))
        .route("/health", get(health::liveness))

        // NFC Routes (most important for your demo)
        .route("/nfc/nonce", get(nfc::get_nonce))
        .route("/nfc/tap", post(nfc::nfc_tap))
        .route("/nfc/provision", post(nfc::nfc_provision))

        // You can add more routes later (swipe, card, auth, etc.)
        // .route("/swipe", post(swipe::process_swipe))
        // .route("/card/balance", get(card::get_balance))

        // Share the state with all handlers
        .with_state(app_state)
        .layer(cors);


    // Start the server
    let addr = "0.0.0.0:8080";
    tracing::info!("🚀 CryptoBridge backend is running on http://{}", addr);

    println!("🚀 CryptoBridge backend is running on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
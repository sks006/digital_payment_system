use axum::{Json, response::IntoResponse};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ConnectRequest {
    pub wallet_address: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
}

pub async fn connect(Json(_payload): Json<ConnectRequest>) -> impl IntoResponse {
    Json(AuthResponse {
        success: true,
        message: "Connected".to_string(),
    })
}

pub async fn disconnect() -> impl IntoResponse {
    Json(AuthResponse {
        success: true,
        message: "Disconnected".to_string(),
    })
}

pub async fn session() -> impl IntoResponse {
    Json(AuthResponse {
        success: true,
        message: "Session active".to_string(),
    })
}

// backend/src/handlers/health.rs

use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub message: String,
    pub timestamp: String,
}

pub async fn liveness() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        message: "CryptoBridge backend is running".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}
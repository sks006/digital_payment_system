use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct BalanceResponse {
    pub balance: f64,
}

pub async fn get_balance() -> Json<BalanceResponse> {
    Json(BalanceResponse { balance: 1250.50 })
}

pub async fn get_transactions() -> Json<Vec<String>> {
    Json(vec!["Initial Deposit".to_string(), "Coffee Shop".to_string()])
}

pub async fn top_up() -> Json<String> {
    Json("Success".to_string())
}

pub async fn freeze() -> Json<String> {
    Json("Frozen".to_string())
}

pub async fn unfreeze() -> Json<String> {
    Json("Unfrozen".to_string())
}

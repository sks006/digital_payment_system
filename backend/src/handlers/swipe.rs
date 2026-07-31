use axum::Json;

pub async fn process_swipe() -> Json<String> {
    Json("Swipe Processed".to_string())
}

pub mod auth;
pub mod config;
pub mod cut_collections;
pub mod db;
pub mod entity;
pub mod events;
pub mod generate;
pub mod materials;
pub mod sessions;

use std::sync::Arc;

use axum::{routing::get, routing::post, routing::patch, routing::delete, Router};
use oauth2::basic::BasicClient;
use sea_orm::DatabaseConnection;

use config::Config;
use events::EventEmitter;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub oauth_client: BasicClient,
    pub db: DatabaseConnection,
    pub http: reqwest::Client,
    pub events: Arc<EventEmitter>,
}

/// Builds the Axum router from a given state — used both in main() and tests.
pub fn build_app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/generate", post(generate::generate))
        .route("/generate-with-graph", post(generate::generate_with_graph))
        .route("/auth/google", get(auth::routes::login))
        .route("/auth/google/callback", get(auth::routes::callback))
        .route("/auth/me", get(auth::routes::me))
        // Cut collections
        .route("/cut-collections", post(cut_collections::routes::create).get(cut_collections::routes::list))
        .route("/cut-collections/{id}", patch(cut_collections::routes::update).delete(cut_collections::routes::remove))
        .route("/cut-collections/{id}/snippets", get(cut_collections::routes::list_snippets))
        // Material ingestion
        .route("/materials", post(materials::routes::create).get(materials::routes::list))
        .route("/materials/upload", post(materials::routes::upload_file))
        .route("/materials/from-github", post(materials::routes::from_github))
        .route("/materials/{id}", get(materials::routes::get_one).delete(materials::routes::remove))
        .route("/materials/{id}/process", post(materials::routes::process))
        .route("/materials/{id}/snippets", get(materials::routes::list_snippets))
        .route("/snippets/random", get(materials::routes::random_snippet))
        // Sessions
        .route("/sessions", post(sessions::routes::create))
        .route("/sessions/{id}", patch(sessions::routes::update))
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}

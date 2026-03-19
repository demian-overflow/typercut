//! Integration tests for HTTP routes.
//!
//! These tests spin up the full Axum router with a *fake* AppState (no real DB,
//! no real Google). They verify routing, auth middleware, and JSON error shapes
//! without making network calls.

use std::sync::Arc;

use axum::{body::Body, http::Request};
use http_body_util::BodyExt;
use lernpunkt_backend::{build_app, AppState};
use oauth2::{
    basic::BasicClient, AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl,
};
use sea_orm::DatabaseConnection;
use tower::ServiceExt;

// ── helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET: &str = "integration-test-secret-min-32-chars!!!";

fn fake_oauth_client() -> BasicClient {
    BasicClient::new(
        ClientId::new("fake-client-id".to_string()),
        Some(ClientSecret::new("fake-secret".to_string())),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string()).unwrap(),
        Some(TokenUrl::new("https://oauth2.googleapis.com/token".to_string()).unwrap()),
    )
    .set_redirect_uri(
        RedirectUrl::new("http://localhost:3001/auth/google/callback".to_string()).unwrap(),
    )
}

/// Build an AppState that has no real DB — panics if a DB query is attempted.
/// Sufficient for routes that only read JWT / config.
fn test_state(db: DatabaseConnection) -> AppState {
    use lernpunkt_backend::config::Config;
    AppState {
        config: Arc::new(Config {
            database_url: "postgres://test".to_string(),
            google_client_id: "fake".to_string(),
            google_client_secret: "fake".to_string(),
            google_redirect_uri: "http://localhost:3001/auth/google/callback".to_string(),
            jwt_secret: JWT_SECRET.to_string(),
            frontend_url: "http://localhost:5173".to_string(),
            port: 3001,
        }),
        oauth_client: fake_oauth_client(),
        db,
    }
}

async fn body_json(body: Body) -> serde_json::Value {
    let bytes = body.collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn health_returns_ok() {
    let app = build_app(test_state(sea_orm::Database::connect("sqlite::memory:").await.unwrap()));
    let resp = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn auth_google_redirects_to_google() {
    let app = build_app(test_state(sea_orm::Database::connect("sqlite::memory:").await.unwrap()));
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/auth/google")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    // Should be a redirect
    assert!(resp.status().is_redirection());
    let location = resp.headers().get("location").unwrap().to_str().unwrap();
    assert!(location.contains("accounts.google.com"));
}

#[tokio::test]
async fn me_without_token_is_401() {
    let app = build_app(test_state(sea_orm::Database::connect("sqlite::memory:").await.unwrap()));
    let resp = app
        .oneshot(Request::builder().uri("/auth/me").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(resp.status(), 401);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["error"], "Missing Authorization header");
}

#[tokio::test]
async fn me_with_invalid_token_is_401() {
    let app = build_app(test_state(sea_orm::Database::connect("sqlite::memory:").await.unwrap()));
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("authorization", "Bearer not.a.real.token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 401);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["error"], "Invalid or expired token");
}

#[tokio::test]
async fn callback_with_error_param_is_400() {
    let app = build_app(test_state(sea_orm::Database::connect("sqlite::memory:").await.unwrap()));
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/auth/google/callback?error=access_denied&code=")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 400);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["error"], "access_denied");
}

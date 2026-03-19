use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{google, jwt};
use crate::{db, AppState};

// ── /auth/google ──────────────────────────────────────────────────────────────

pub async fn login(State(state): State<AppState>) -> Response {
    let (url, _csrf) = google::authorization_url(&state.oauth_client);
    // In production: persist _csrf in a signed cookie and verify in callback.
    Redirect::to(&url).into_response()
}

// ── /auth/google/callback ─────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CallbackParams {
    pub code: String,
    /// Google echoes back the CSRF state we sent (verify in production).
    #[allow(dead_code)]
    pub state: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
}

pub async fn callback(
    State(state): State<AppState>,
    Query(params): Query<CallbackParams>,
) -> Response {
    if let Some(err) = params.error {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": err })),
        )
            .into_response();
    }

    // 1. Exchange Google code for user profile.
    let google_user = match google::exchange_code(&state.oauth_client, &params.code).await {
        Ok(u) => u,
        Err(e) => {
            tracing::error!("Google exchange failed: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "OAuth exchange failed" })),
            )
                .into_response();
        }
    };

    // 2. Upsert into the database.
    let db_user = match db::users::upsert(
        &state.db,
        db::users::UpsertInput {
            google_id: &google_user.sub,
            email: &google_user.email,
            name: &google_user.name,
            picture: google_user.picture.as_deref(),
        },
    )
    .await
    {
        Ok(u) => u,
        Err(e) => {
            tracing::error!("DB upsert failed: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        }
    };

    // 3. Mint a JWT whose `sub` is the DB UUID.
    let token = match jwt::create_token(
        &state.config.jwt_secret,
        &db_user.id.to_string(),
        &db_user.email,
        &db_user.name,
        db_user.picture.as_deref(),
    ) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("JWT creation failed: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Token creation failed" })),
            )
                .into_response();
        }
    };

    // 4. Redirect to frontend with the token.
    let redirect_url = format!("{}?token={}", state.config.frontend_url, token);
    Redirect::to(&redirect_url).into_response()
}

// ── /auth/me ──────────────────────────────────────────────────────────────────

pub async fn me(State(state): State<AppState>, headers: axum::http::HeaderMap) -> Response {
    let token = match extract_bearer(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Missing Authorization header" })),
            )
                .into_response();
        }
    };

    let claims = match jwt::verify_token(&state.config.jwt_secret, &token) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Invalid token: {e}");
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Invalid or expired token" })),
            )
                .into_response();
        }
    };

    // Fetch fresh user data from DB.
    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Malformed token subject" })),
            )
                .into_response();
        }
    };

    match db::users::find_by_id(&state.db, user_id).await {
        Ok(Some(u)) => Json(UserInfo {
            id: u.id.to_string(),
            email: u.email,
            name: u.name,
            picture: u.picture,
        })
        .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "User not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("DB lookup failed: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

fn extract_bearer(headers: &axum::http::HeaderMap) -> Option<String> {
    let value = headers.get("authorization")?.to_str().ok()?;
    value.strip_prefix("Bearer ").map(str::to_string)
}

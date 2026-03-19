use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{auth::jwt, db, AppState};

// ── Auth helper (same pattern as materials) ───────────────────────────────────

fn bearer(headers: &axum::http::HeaderMap) -> Option<String> {
    let v = headers.get("authorization")?.to_str().ok()?;
    v.strip_prefix("Bearer ").map(str::to_string)
}

fn auth(headers: &axum::http::HeaderMap, jwt_secret: &str) -> Result<Uuid, Response> {
    let token = bearer(headers).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Missing Authorization header" })),
        )
            .into_response()
    })?;
    let claims = jwt::verify_token(jwt_secret, &token).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Invalid or expired token" })),
        )
            .into_response()
    })?;
    claims.sub.parse::<Uuid>().map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Malformed token" })),
        )
            .into_response()
    })
}

// ── POST /sessions ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateSessionBody {
    pub snippet_id: Option<Uuid>,
    pub text: String,
    /// "snippet" | "generated" | "manual"
    pub source: Option<String>,
}

pub async fn create(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<CreateSessionBody>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(id) => id,
        Err(r) => return r,
    };

    let source = body.source.as_deref().unwrap_or("snippet");

    match db::sessions::create(&state.db, user_id, body.snippet_id, body.text.clone(), source).await {
        Ok(session) => {
            state.events.emit(
                "session.started",
                Some(user_id),
                Some("session"),
                Some(session.id),
                serde_json::json!({
                    "snippet_id": body.snippet_id,
                    "text_length": body.text.len(),
                    "source": source,
                }),
            );
            (
                StatusCode::CREATED,
                Json(serde_json::json!({ "id": session.id })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("create session: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── PATCH /sessions/:id ───────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateSessionBody {
    /// "completed" | "abandoned"
    pub status: String,
    // Stats — required when status = "completed"
    pub wpm: Option<f64>,
    pub accuracy: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub total_keystrokes: Option<i32>,
    pub correct_keystrokes: Option<i32>,
}

pub async fn update(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSessionBody>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    match body.status.as_str() {
        "completed" => {
            let stats = db::sessions::CompleteInput {
                wpm: body.wpm.unwrap_or(0.0),
                accuracy: body.accuracy.unwrap_or(0.0),
                duration_seconds: body.duration_seconds.unwrap_or(0.0),
                total_keystrokes: body.total_keystrokes.unwrap_or(0),
                correct_keystrokes: body.correct_keystrokes.unwrap_or(0),
            };
            match db::sessions::complete(&state.db, id, user_id, stats).await {
                Ok(Some(_)) => {
                    state.events.emit(
                        "session.completed",
                        Some(user_id),
                        Some("session"),
                        Some(id),
                        serde_json::json!({
                            "wpm": body.wpm,
                            "accuracy": body.accuracy,
                            "duration_seconds": body.duration_seconds,
                            "total_keystrokes": body.total_keystrokes,
                            "correct_keystrokes": body.correct_keystrokes,
                        }),
                    );
                    StatusCode::NO_CONTENT.into_response()
                }
                Ok(None) => (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({ "error": "Session not found" })),
                )
                    .into_response(),
                Err(e) => {
                    tracing::error!("complete session: {e}");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": "Database error" })),
                    )
                        .into_response()
                }
            }
        }
        "abandoned" => {
            match db::sessions::abandon(&state.db, id, user_id).await {
                Ok(true) => {
                    state.events.emit(
                        "session.abandoned",
                        Some(user_id),
                        Some("session"),
                        Some(id),
                        serde_json::json!({}),
                    );
                    StatusCode::NO_CONTENT.into_response()
                }
                Ok(false) => (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({ "error": "Session not found" })),
                )
                    .into_response(),
                Err(e) => {
                    tracing::error!("abandon session: {e}");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": "Database error" })),
                    )
                        .into_response()
                }
            }
        }
        _ => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "status must be 'completed' or 'abandoned'" })),
        )
            .into_response(),
    }
}

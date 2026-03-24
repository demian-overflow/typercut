use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth::jwt, db, AppState};

// ── Auth helper (mirrors materials::routes) ───────────────────────────────────

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

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateCollectionBody {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateCollectionBody {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Serialize)]
pub struct CutCollectionDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct SnippetDto {
    pub id: String,
    pub material_id: String,
    pub text: String,
    pub word_count: i32,
}

// ── GET /cut-collections ──────────────────────────────────────────────────────

pub async fn list(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(id) => id,
        Err(r) => return r,
    };

    match db::cut_collections::list_by_user(&state.db, user_id).await {
        Ok(cols) => Json(
            cols.into_iter()
                .map(|c| CutCollectionDto {
                    id: c.id.to_string(),
                    name: c.name,
                    description: c.description,
                    created_at: c.created_at.to_rfc3339(),
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(e) => {
            tracing::error!("list cut_collections: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── POST /cut-collections ─────────────────────────────────────────────────────

pub async fn create(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<CreateCollectionBody>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(id) => id,
        Err(r) => return r,
    };

    match db::cut_collections::create(
        &state.db,
        user_id,
        &body.name,
        body.description.as_deref(),
    )
    .await
    {
        Ok(c) => (
            StatusCode::CREATED,
            Json(CutCollectionDto {
                id: c.id.to_string(),
                name: c.name,
                description: c.description,
                created_at: c.created_at.to_rfc3339(),
            }),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("create cut_collection: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── PATCH /cut-collections/:id ────────────────────────────────────────────────

pub async fn update(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCollectionBody>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    match db::cut_collections::update(
        &state.db,
        id,
        user_id,
        &body.name,
        body.description.as_deref(),
    )
    .await
    {
        Ok(Some(c)) => Json(CutCollectionDto {
            id: c.id.to_string(),
            name: c.name,
            description: c.description,
            created_at: c.created_at.to_rfc3339(),
        })
        .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("update cut_collection: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── DELETE /cut-collections/:id ───────────────────────────────────────────────

pub async fn remove(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    match db::cut_collections::delete(&state.db, id, user_id).await {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("delete cut_collection: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── GET /cut-collections/:id/snippets ─────────────────────────────────────────

pub async fn list_snippets(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    match db::snippets::list_by_collection(&state.db, id, user_id).await {
        Ok(snippets) => Json(
            snippets
                .into_iter()
                .map(|s| SnippetDto {
                    id: s.id.to_string(),
                    material_id: s.material_id.to_string(),
                    text: s.text,
                    word_count: s.word_count,
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(e) => {
            tracing::error!("list snippets by collection: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

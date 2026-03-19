use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth::jwt, db, AppState};

// ── Shared auth helper ────────────────────────────────────────────────────────

fn bearer(headers: &axum::http::HeaderMap) -> Option<String> {
    let v = headers.get("authorization")?.to_str().ok()?;
    v.strip_prefix("Bearer ").map(str::to_string)
}

/// Extracts and verifies JWT, returns (user_id_uuid).
/// On failure returns an error Response.
fn auth(
    headers: &axum::http::HeaderMap,
    jwt_secret: &str,
) -> Result<Uuid, Response> {
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
pub struct CreateMaterialBody {
    pub title: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct MaterialDto {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct SnippetDto {
    pub id: String,
    pub material_id: String,
    pub text: String,
    pub word_count: i32,
}

// ── POST /materials ───────────────────────────────────────────────────────────

pub async fn create(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<CreateMaterialBody>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(id) => id,
        Err(r) => return r,
    };

    match db::materials::create(&state.db, user_id, &body.title, &body.content).await {
        Ok(m) => {
            state.events.emit(
                "material.created",
                Some(user_id),
                Some("material"),
                Some(m.id),
                serde_json::json!({
                    "source": "paste",
                    "content_length": m.content.len(),
                }),
            );
            (
                StatusCode::CREATED,
                Json(MaterialDto {
                    id: m.id.to_string(),
                    title: m.title,
                    content: m.content,
                    created_at: m.created_at.to_rfc3339(),
                }),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("create material: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── GET /materials ────────────────────────────────────────────────────────────

pub async fn list(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(id) => id,
        Err(r) => return r,
    };

    match db::materials::list_by_user(&state.db, user_id).await {
        Ok(ms) => Json(
            ms.into_iter()
                .map(|m| MaterialDto {
                    id: m.id.to_string(),
                    title: m.title,
                    content: m.content,
                    created_at: m.created_at.to_rfc3339(),
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(e) => {
            tracing::error!("list materials: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── GET /materials/:id ────────────────────────────────────────────────────────

pub async fn get_one(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    match db::materials::find_by_id(&state.db, id, user_id).await {
        Ok(Some(m)) => Json(MaterialDto {
            id: m.id.to_string(),
            title: m.title,
            content: m.content,
            created_at: m.created_at.to_rfc3339(),
        })
        .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("get material: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── DELETE /materials/:id ─────────────────────────────────────────────────────

pub async fn remove(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    match db::materials::delete(&state.db, id, user_id).await {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("delete material: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── POST /materials/:id/process ───────────────────────────────────────────────
//
// Delegates to action_pool which calls Claude and returns structured snippets.

#[derive(Deserialize)]
struct ActionPoolSnippet {
    text: String,
    word_count: i32,
}

#[derive(Deserialize)]
struct ActionPoolResponse {
    snippets: Vec<ActionPoolSnippet>,
}

pub async fn process(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    let material = match db::materials::find_by_id_required(&state.db, id, user_id).await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Not found" })),
            )
                .into_response()
        }
    };

    let url = format!("{}/v1/ingest/process", state.config.action_pool_url);
    let resp = state
        .http
        .post(&url)
        .json(&serde_json::json!({ "content": material.content }))
        .send()
        .await;

    let ap_resp = match resp {
        Ok(r) if r.status().is_success() => match r.json::<ActionPoolResponse>().await {
            Ok(body) => body,
            Err(e) => {
                tracing::error!("action_pool parse error: {e}");
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(serde_json::json!({ "error": "Invalid response from AI service" })),
                )
                    .into_response();
            }
        },
        Ok(r) => {
            tracing::error!("action_pool returned {}", r.status());
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "AI service error" })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("action_pool request failed: {e}");
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "AI service unavailable" })),
            )
                .into_response();
        }
    };

    let inputs: Vec<db::snippets::SnippetInput> = ap_resp
        .snippets
        .into_iter()
        .map(|s| db::snippets::SnippetInput {
            text: s.text,
            word_count: s.word_count,
        })
        .collect();

    match db::snippets::insert_batch(&state.db, id, user_id, inputs).await {
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
            tracing::error!("insert snippets: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── GET /materials/:id/snippets ───────────────────────────────────────────────

pub async fn list_snippets(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    match db::snippets::list_by_material(&state.db, id, user_id).await {
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
            tracing::error!("list snippets: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── GET /snippets/random ──────────────────────────────────────────────────────

pub async fn random_snippet(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    match db::snippets::random_for_user(&state.db, user_id).await {
        Ok(Some(s)) => Json(SnippetDto {
            id: s.id.to_string(),
            material_id: s.material_id.to_string(),
            text: s.text,
            word_count: s.word_count,
        })
        .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "No snippets yet" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("random snippet: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── Shared: call action_pool extract then create+process material ─────────────

#[derive(Deserialize)]
struct ExtractResponse {
    title: String,
    content: String,
}

async fn create_and_process(
    state: &AppState,
    user_id: Uuid,
    title: String,
    content: String,
    source: &str,
) -> Response {
    let material = match db::materials::create(&state.db, user_id, &title, &content).await {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("create material: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response();
        }
    };

    let url = format!("{}/v1/ingest/process", state.config.action_pool_url);
    let resp = state
        .http
        .post(&url)
        .json(&serde_json::json!({ "content": material.content }))
        .send()
        .await;

    let ap_resp = match resp {
        Ok(r) if r.status().is_success() => match r.json::<ActionPoolResponse>().await {
            Ok(body) => body,
            Err(e) => {
                tracing::error!("action_pool parse error: {e}");
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(serde_json::json!({ "error": "Invalid response from AI service" })),
                )
                    .into_response();
            }
        },
        Ok(r) => {
            tracing::error!("action_pool returned {}", r.status());
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "AI service error" })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("action_pool request failed: {e}");
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "AI service unavailable" })),
            )
                .into_response();
        }
    };

    let inputs: Vec<db::snippets::SnippetInput> = ap_resp
        .snippets
        .into_iter()
        .map(|s| db::snippets::SnippetInput {
            text: s.text,
            word_count: s.word_count,
        })
        .collect();

    match db::snippets::insert_batch(&state.db, material.id, user_id, inputs).await {
        Ok(snippets) => {
            state.events.emit(
                "material.created",
                Some(user_id),
                Some("material"),
                Some(material.id),
                serde_json::json!({
                    "source": source,
                    "content_length": material.content.len(),
                }),
            );
            state.events.emit(
                "material.processed",
                Some(user_id),
                Some("material"),
                Some(material.id),
                serde_json::json!({
                    "snippet_count": snippets.len(),
                    "source": source,
                }),
            );
            (
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "material": {
                        "id": material.id.to_string(),
                        "title": material.title,
                    },
                    "snippets": snippets.iter().map(|s| serde_json::json!({
                        "id": s.id.to_string(),
                        "material_id": s.material_id.to_string(),
                        "text": s.text,
                        "word_count": s.word_count,
                    })).collect::<Vec<_>>(),
                })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("insert snippets: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Database error" })),
            )
                .into_response()
        }
    }
}

// ── POST /materials/upload ────────────────────────────────────────────────────

pub async fn upload_file(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    mut multipart: Multipart,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    // Read the single file field from the multipart form
    let field = match multipart.next_field().await {
        Ok(Some(f)) => f,
        Ok(None) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "No file provided" })),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("multipart error: {e}");
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid multipart data" })),
            )
                .into_response();
        }
    };

    let filename = field.file_name().unwrap_or("upload").to_string();
    let content_type = field
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();

    let bytes = match field.bytes().await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!("reading field bytes: {e}");
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Failed to read file data" })),
            )
                .into_response();
        }
    };

    // Forward to action_pool /ingest/extract-file for text extraction
    let extract_url = format!("{}/v1/ingest/extract-file", state.config.action_pool_url);
    let part = reqwest::multipart::Part::bytes(bytes.to_vec())
        .file_name(filename.clone())
        .mime_str(&content_type)
        .unwrap_or_else(|_| reqwest::multipart::Part::bytes(bytes.to_vec()));
    let form = reqwest::multipart::Form::new().part("file", part);

    let extract_resp = match state.http.post(&extract_url).multipart(form).send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("action_pool extract-file failed: {e}");
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "AI service unavailable" })),
            )
                .into_response();
        }
    };

    if !extract_resp.status().is_success() {
        let status = extract_resp.status();
        let body = extract_resp
            .json::<serde_json::Value>()
            .await
            .unwrap_or_default();
        tracing::error!("extract-file returned {status}: {body}");
        return (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": body["detail"].as_str().unwrap_or("Extraction failed") })),
        )
            .into_response();
    }

    let extracted: ExtractResponse = match extract_resp.json().await {
        Ok(e) => e,
        Err(e) => {
            tracing::error!("parse extract-file response: {e}");
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "Invalid response from extraction service" })),
            )
                .into_response();
        }
    };

    create_and_process(&state, user_id, extracted.title, extracted.content, "file").await
}

// ── POST /materials/from-github ───────────────────────────────────────────────

#[derive(Deserialize)]
pub struct FromGitHubBody {
    pub url: String,
}

pub async fn from_github(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<FromGitHubBody>,
) -> Response {
    let user_id = match auth(&headers, &state.config.jwt_secret) {
        Ok(uid) => uid,
        Err(r) => return r,
    };

    let github_url = format!("{}/v1/ingest/from-github", state.config.action_pool_url);
    let fetch_resp = match state
        .http
        .post(&github_url)
        .json(&serde_json::json!({ "url": body.url }))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("action_pool from-github failed: {e}");
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "AI service unavailable" })),
            )
                .into_response();
        }
    };

    if !fetch_resp.status().is_success() {
        let ap_status = fetch_resp.status();
        let ap_body = fetch_resp
            .json::<serde_json::Value>()
            .await
            .unwrap_or_default();
        tracing::error!("from-github returned {ap_status}: {ap_body}");
        let code = match ap_status.as_u16() {
            404 => StatusCode::NOT_FOUND,
            422 => StatusCode::UNPROCESSABLE_ENTITY,
            _ => StatusCode::BAD_GATEWAY,
        };
        return (
            code,
            Json(serde_json::json!({ "error": ap_body["detail"].as_str().unwrap_or("GitHub fetch failed") })),
        )
            .into_response();
    }

    let extracted: ExtractResponse = match fetch_resp.json().await {
        Ok(e) => e,
        Err(e) => {
            tracing::error!("parse from-github response: {e}");
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "Invalid response from fetch service" })),
            )
                .into_response();
        }
    };

    create_and_process(&state, user_id, extracted.title, extracted.content, "github").await
}

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};

use crate::AppState;

#[derive(Deserialize)]
pub struct GenerateRequest {
    pub topic: String,
    pub style: String, // "prose" | "quotes" | "code"
    pub length: String, // "short" | "medium" | "long"
}

#[derive(Serialize)]
pub struct GenerateResponse {
    pub text: String,
}

#[derive(Deserialize)]
struct OAIMessage {
    content: String,
}

#[derive(Deserialize)]
struct OAIChoice {
    message: OAIMessage,
}

#[derive(Deserialize)]
struct OAIResponse {
    choices: Vec<OAIChoice>,
}

pub async fn generate(
    State(state): State<AppState>,
    Json(body): Json<GenerateRequest>,
) -> impl IntoResponse {
    let words: u32 = match body.length.as_str() {
        "short" => 30,
        "long" => 120,
        _ => 60,
    };

    let style_guide = match body.style.as_str() {
        "quotes" => "a series of short memorable sentences or aphorisms",
        "code" => "a short code snippet with a brief explanation (no backtick fences)",
        _ => "a flowing informational paragraph",
    };

    let url = format!("{}/v1/inference/llm/openai", state.config.action_pool_url);
    let payload = serde_json::json!({
        "model": "claude-opus-4-6",
        "max_tokens": 512,
        "messages": [
            {
                "role": "system",
                "content": "You generate typing exercise passages. Output only the text to type — no markdown, no headers, no quotes around the passage, no extra commentary. The text should be clean, accurate, and varied in punctuation to make it a good typing challenge."
            },
            {
                "role": "user",
                "content": format!("Topic: \"{}\". Style: {}. Target length: ~{} words.", body.topic, style_guide, words)
            }
        ]
    });

    let resp = match state.http.post(&url).json(&payload).send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("action_pool request failed: {e}");
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "AI service unavailable" })),
            )
                .into_response();
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        tracing::error!("action_pool returned {status}: {body}");
        return (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": "AI service error" })),
        )
            .into_response();
    }

    match resp.json::<OAIResponse>().await {
        Ok(oai) => {
            let text = oai
                .choices
                .into_iter()
                .next()
                .map(|c| c.message.content)
                .unwrap_or_default()
                .trim()
                .to_string();
            Json(GenerateResponse { text }).into_response()
        }
        Err(e) => {
            tracing::error!("action_pool parse error: {e}");
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "Invalid response from AI service" })),
            )
                .into_response()
        }
    }
}

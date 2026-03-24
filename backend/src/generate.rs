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

// --- Graph types ---

#[derive(Deserialize, Serialize, Clone)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub x: f32,
    pub y: f32,
    // segmentStart/segmentEnd filled in by backend after text is known
    #[serde(default)]
    pub segment_start: usize,
    #[serde(default)]
    pub segment_end: usize,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    #[serde(default)]
    pub label: Option<String>,
}

/// The shape Claude returns (without segment offsets — backend computes those).
#[derive(Deserialize)]
struct LlmGraph {
    nodes: Vec<GraphNode>,
    edges: Vec<GraphEdge>,
    traversal_order: Vec<String>,
}

/// Full graph returned to the frontend (nodes have segment_start/segment_end filled in).
#[derive(Serialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub traversal_order: Vec<String>,
}

#[derive(Serialize)]
pub struct GenerateWithGraphResponse {
    pub text: String,
    pub graph: GraphData,
}

/// Split `text` into `n` segments at word boundaries.
/// Returns Vec of (start, end) byte offsets (end exclusive).
fn word_boundary_segments(text: &str, n: usize) -> Vec<(usize, usize)> {
    if n == 0 || text.is_empty() {
        return vec![];
    }
    let total = text.len();
    let mut segments = Vec::with_capacity(n);
    let mut start = 0usize;
    for i in 0..n {
        if i == n - 1 {
            segments.push((start, total));
            break;
        }
        let target = total * (i + 1) / n;
        // Advance to nearest space at or after target, then skip the space
        let end = text[target..]
            .find(' ')
            .map(|pos| target + pos + 1)
            .unwrap_or(total);
        segments.push((start, end.min(total)));
        start = end.min(total);
    }
    segments
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

pub async fn generate_with_graph(
    State(state): State<AppState>,
    Json(body): Json<GenerateRequest>,
) -> impl IntoResponse {
    let words: u32 = match body.length.as_str() {
        "short" => 30,
        "long" => 120,
        _ => 60,
    };
    let node_count: usize = match body.length.as_str() {
        "short" => 4,
        "long" => 8,
        _ => 6,
    };

    let style_guide = match body.style.as_str() {
        "quotes" => "a series of short memorable sentences or aphorisms",
        "code" => "a short code snippet with a brief explanation (no backtick fences)",
        _ => "a flowing informational paragraph",
    };

    let system_prompt = format!(
        r#"You generate typing exercises paired with concept graphs. Output ONLY valid JSON — no markdown fences, no commentary.

Schema:
{{
  "text": "<the passage to type>",
  "graph": {{
    "nodes": [
      {{"id": "n0", "label": "<concept>", "x": <0-1>, "y": <0-1>}},
      ...
    ],
    "edges": [
      {{"from": "n0", "to": "n1", "label": "<relationship>"}},
      ...
    ],
    "traversal_order": ["n0", "n1", ...]
  }}
}}

Rules:
- The passage must walk through each concept in traversal_order order (one concept per sentence/clause grouping).
- Use exactly {node_count} nodes, one per major concept.
- Node x/y are layout hints (0.05–0.95) — spread them so nodes do not overlap.
- Edges represent named relationships between concepts.
- Text: no markdown, no headers, clean prose."#
    );

    let url = format!("{}/v1/inference/llm/openai", state.config.action_pool_url);
    let payload = serde_json::json!({
        "model": "claude-opus-4-6",
        "max_tokens": 1024,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": format!("Topic: \"{}\". Style: {}. Target length: ~{} words.", body.topic, style_guide, words)}
        ]
    });

    let resp = match state.http.post(&url).json(&payload).send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("action_pool request failed: {e}");
            return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": "AI service unavailable"}))).into_response();
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        tracing::error!("action_pool returned {status}: {body}");
        return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": "AI service error"}))).into_response();
    }

    let raw_content = match resp.json::<OAIResponse>().await {
        Ok(oai) => oai.choices.into_iter().next().map(|c| c.message.content).unwrap_or_default(),
        Err(e) => {
            tracing::error!("action_pool parse error: {e}");
            return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": "Invalid response from AI service"}))).into_response();
        }
    };

    // Strip optional markdown fences the model may have added anyway
    let json_str = raw_content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    #[derive(Deserialize)]
    struct LlmOutput {
        text: String,
        graph: LlmGraph,
    }

    let parsed: LlmOutput = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("graph JSON parse failed: {e}\nRaw: {json_str}");
            return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": "Could not parse graph from AI response"}))).into_response();
        }
    };

    let text = parsed.text.trim().to_string();
    let mut graph_nodes = parsed.graph.nodes;
    let traversal_order = parsed.graph.traversal_order;

    // Compute word-boundary segments and assign to nodes in traversal order
    let segments = word_boundary_segments(&text, traversal_order.len());
    for (idx, node_id) in traversal_order.iter().enumerate() {
        if let Some(node) = graph_nodes.iter_mut().find(|n| &n.id == node_id) {
            if let Some(&(start, end)) = segments.get(idx) {
                node.segment_start = start;
                node.segment_end = end;
            }
        }
    }

    Json(GenerateWithGraphResponse {
        text,
        graph: GraphData {
            nodes: graph_nodes,
            edges: parsed.graph.edges,
            traversal_order,
        },
    }).into_response()
}

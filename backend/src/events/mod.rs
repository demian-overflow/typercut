//! Async Kafka event emitter.
//!
//! Every user action that should be warehoused calls `EventEmitter::emit`.
//! The call is fire-and-forget: it spawns a Tokio task and returns immediately
//! so request latency is not affected by Kafka availability.
//!
//! Topic layout: one topic `typercut.events`, partitioned by user_id.
//! Consumers (ClickHouse sink, ML pipeline, etc.) subscribe to this topic.

use std::sync::Arc;
use std::time::Duration;

use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

pub const TOPIC: &str = "typercut.events";

#[derive(Clone)]
pub struct EventEmitter {
    producer: Arc<FutureProducer>,
}

/// The envelope written to Kafka.
#[derive(Serialize)]
struct Envelope {
    event_id: Uuid,
    event_type: String,
    user_id: Option<Uuid>,
    entity_type: Option<String>,
    entity_id: Option<Uuid>,
    occurred_at: String,
    payload: Value,
}

impl EventEmitter {
    /// Build a producer connected to `brokers` (comma-separated host:port list).
    pub fn new(brokers: &str) -> anyhow::Result<Self> {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("message.timeout.ms", "5000")
            .set("queue.buffering.max.ms", "50")
            .create()?;
        Ok(Self {
            producer: Arc::new(producer),
        })
    }

    /// Emit an event asynchronously. Returns immediately; delivery is best-effort.
    ///
    /// # Arguments
    /// * `event_type`  – dot-namespaced name, e.g. `"material.created"`
    /// * `user_id`     – actor (None for system events)
    /// * `entity_type` – the domain object kind, e.g. `"material"`
    /// * `entity_id`   – the domain object id
    /// * `payload`     – arbitrary JSON with event-specific fields
    pub fn emit(
        &self,
        event_type: impl Into<String>,
        user_id: Option<Uuid>,
        entity_type: Option<&str>,
        entity_id: Option<Uuid>,
        payload: Value,
    ) {
        let producer = Arc::clone(&self.producer);
        let envelope = Envelope {
            event_id: Uuid::new_v4(),
            event_type: event_type.into(),
            user_id,
            entity_type: entity_type.map(str::to_string),
            entity_id,
            occurred_at: chrono::Utc::now().to_rfc3339(),
            payload,
        };

        let key = user_id
            .map(|u| u.to_string())
            .unwrap_or_else(|| "system".to_string());

        tokio::spawn(async move {
            let value = match serde_json::to_string(&envelope) {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!("event serialization failed: {e}");
                    return;
                }
            };

            let record = FutureRecord::to(TOPIC).key(&key).payload(&value);
            match producer.send(record, Duration::from_secs(0)).await {
                Ok(_) => {}
                Err((e, _)) => {
                    // Non-fatal — event is dropped but request succeeds.
                    tracing::warn!("kafka delivery failed ({}): {e}", envelope.event_type);
                }
            }
        });
    }
}

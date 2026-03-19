use std::sync::Arc;

use axum::http::{HeaderValue, Method};
use lernpunkt_backend::{auth, build_app, config::Config, db, events::EventEmitter, AppState};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "lernpunkt_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env()?;
    let oauth_client = auth::google::build_client(&config)?;
    let db = db::connect_and_migrate(&config.database_url).await?;
    tracing::info!("DB ready");

    let emitter = EventEmitter::new(&config.kafka_brokers)?;
    tracing::info!("Kafka producer ready (brokers: {})", config.kafka_brokers);

    let state = AppState {
        config: Arc::new(config.clone()),
        oauth_client,
        db,
        http: reqwest::Client::new(),
        events: Arc::new(emitter),
    };

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact(
            config.frontend_url.parse::<HeaderValue>()?,
        ))
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers(tower_http::cors::Any);

    let app = build_app(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Listening on {addr}");
    axum::serve(listener, app).await?;

    Ok(())
}

use anyhow::{Context, Result};

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_uri: String,
    pub jwt_secret: String,
    pub frontend_url: String,
    pub port: u16,
    pub action_pool_url: String,
    pub kafka_brokers: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Config {
            database_url: require("DATABASE_URL")?,
            google_client_id: require("GOOGLE_CLIENT_ID")?,
            google_client_secret: require("GOOGLE_CLIENT_SECRET")?,
            google_redirect_uri: std::env::var("GOOGLE_REDIRECT_URI")
                .unwrap_or_else(|_| "http://localhost:3001/auth/google/callback".to_string()),
            jwt_secret: require("JWT_SECRET")?,
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .context("PORT must be a number")?,
            action_pool_url: std::env::var("ACTION_POOL_URL")
                .unwrap_or_else(|_| "http://localhost:8000".to_string()),
            kafka_brokers: std::env::var("KAFKA_BROKERS")
                .unwrap_or_else(|_| "localhost:9092".to_string()),
        })
    }
}

fn require(key: &str) -> Result<String> {
    std::env::var(key).with_context(|| format!("Missing required env var: {key}"))
}

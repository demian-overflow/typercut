use anyhow::{anyhow, Result};
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, AuthorizationCode, ClientId,
    ClientSecret, CsrfToken, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use serde::Deserialize;

use crate::config::Config;

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v3/userinfo";

pub fn build_client(config: &Config) -> Result<BasicClient> {
    let client = BasicClient::new(
        ClientId::new(config.google_client_id.clone()),
        Some(ClientSecret::new(config.google_client_secret.clone())),
        AuthUrl::new(AUTH_URL.to_string())?,
        Some(TokenUrl::new(TOKEN_URL.to_string())?),
    )
    .set_redirect_uri(RedirectUrl::new(config.google_redirect_uri.clone())?);
    Ok(client)
}

/// Returns (auth_url, csrf_state) — store csrf_state in a short-lived cookie.
pub fn authorization_url(client: &BasicClient) -> (String, CsrfToken) {
    let (url, state) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("openid".to_string()))
        .add_scope(Scope::new("email".to_string()))
        .add_scope(Scope::new("profile".to_string()))
        .url();
    (url.to_string(), state)
}

/// Exchange the authorization code for tokens and fetch the user profile.
pub async fn exchange_code(client: &BasicClient, code: &str) -> Result<GoogleUser> {
    let token = client
        .exchange_code(AuthorizationCode::new(code.to_string()))
        .request_async(async_http_client)
        .await
        .map_err(|e| anyhow!("Token exchange failed: {e}"))?;

    let access_token = token.access_token().secret();

    let user: GoogleUser = reqwest::Client::new()
        .get(USERINFO_URL)
        .bearer_auth(access_token)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(user)
}

#[derive(Debug, Deserialize)]
pub struct GoogleUser {
    pub sub: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
    #[allow(dead_code)]
    pub email_verified: Option<bool>,
}

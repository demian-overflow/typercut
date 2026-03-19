use anyhow::Result;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

const TOKEN_TTL_HOURS: i64 = 24 * 7; // 7 days

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject — DB user UUID
    pub sub: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
    pub iat: i64,
    pub exp: i64,
}

pub fn create_token(
    secret: &str,
    sub: &str,
    email: &str,
    name: &str,
    picture: Option<&str>,
) -> Result<String> {
    let now = Utc::now();
    let claims = Claims {
        sub: sub.to_string(),
        email: email.to_string(),
        name: name.to_string(),
        picture: picture.map(str::to_string),
        iat: now.timestamp(),
        exp: (now + Duration::hours(TOKEN_TTL_HOURS)).timestamp(),
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;
    Ok(token)
}

pub fn verify_token(secret: &str, token: &str) -> Result<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-secret-at-least-32-chars-long!!";
    const USER_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

    fn make_token() -> String {
        create_token(SECRET, USER_ID, "alice@example.com", "Alice", Some("https://pic"))
            .expect("token creation should succeed")
    }

    #[test]
    fn round_trip() {
        let token = make_token();
        let claims = verify_token(SECRET, &token).expect("should verify");
        assert_eq!(claims.sub, USER_ID);
        assert_eq!(claims.email, "alice@example.com");
        assert_eq!(claims.name, "Alice");
        assert_eq!(claims.picture.as_deref(), Some("https://pic"));
    }

    #[test]
    fn wrong_secret_rejected() {
        let token = make_token();
        assert!(verify_token("wrong-secret", &token).is_err());
    }

    #[test]
    fn tampered_token_rejected() {
        let token = make_token();
        let tampered = format!("{token}x");
        assert!(verify_token(SECRET, &tampered).is_err());
    }

    #[test]
    fn no_picture_allowed() {
        let token = create_token(SECRET, USER_ID, "bob@example.com", "Bob", None)
            .expect("creation ok");
        let claims = verify_token(SECRET, &token).expect("verify ok");
        assert!(claims.picture.is_none());
    }
}

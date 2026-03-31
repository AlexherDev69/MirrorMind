use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use rand::RngCore;
use std::path::Path;
use std::sync::Arc;

const TOKEN_FILE_NAME: &str = "mcp_auth_token";

/// Constant-time byte comparison to prevent timing attacks on token validation.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Shared application state for the internal API.
#[derive(Clone)]
pub struct ApiState {
    pub token: String,
    pub app_handle: tauri::AppHandle,
    pub start_time: std::time::Instant,
}

/// Generate a cryptographically random authentication token (32 bytes, hex-encoded).
fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Load the persisted token from disk, or generate and persist a new one.
pub fn load_or_create_token(app_data_dir: &Path) -> String {
    let token_path = app_data_dir.join(TOKEN_FILE_NAME);

    if let Ok(token) = std::fs::read_to_string(&token_path) {
        let token = token.trim().to_string();
        if token.len() == 64 && token.chars().all(|c| c.is_ascii_hexdigit()) {
            return token;
        }
    }

    let token = generate_token();
    std::fs::create_dir_all(app_data_dir).ok();
    std::fs::write(&token_path, &token).ok();
    token
}

/// Axum middleware that validates Bearer token and Host header.
pub async fn auth_middleware(
    State(state): State<Arc<ApiState>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Validate Host header to prevent DNS rebinding (strict equality with port)
    let host_str = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let is_valid_host = (17395..=17400).any(|port| {
        host_str == format!("127.0.0.1:{}", port) || host_str == format!("localhost:{}", port)
    });
    if !is_valid_host {
        return Err(StatusCode::FORBIDDEN);
    }

    // Validate Bearer token
    let auth_header = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let provided_token = &auth_header[7..];
    if !constant_time_eq(provided_token.as_bytes(), state.token.as_bytes()) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constant_time_eq_same() {
        assert!(constant_time_eq(b"hello", b"hello"));
    }

    #[test]
    fn test_constant_time_eq_different() {
        assert!(!constant_time_eq(b"hello", b"world"));
    }

    #[test]
    fn test_constant_time_eq_different_length() {
        assert!(!constant_time_eq(b"short", b"longer_string"));
    }

    #[test]
    fn test_constant_time_eq_empty() {
        assert!(constant_time_eq(b"", b""));
    }

    #[test]
    fn test_generate_token_length() {
        let token = generate_token();
        assert_eq!(token.len(), 64, "Token should be 64 hex chars (32 bytes)");
    }

    #[test]
    fn test_generate_token_is_hex() {
        let token = generate_token();
        assert!(
            token.chars().all(|c| c.is_ascii_hexdigit()),
            "Token should contain only hex characters"
        );
    }

    #[test]
    fn test_generate_token_unique() {
        let t1 = generate_token();
        let t2 = generate_token();
        assert_ne!(t1, t2, "Two tokens should be different");
    }

    #[test]
    fn test_load_or_create_token_creates_new() {
        let dir = std::env::temp_dir().join(format!("phonestream_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);

        let token = load_or_create_token(&dir);
        assert_eq!(token.len(), 64);
        assert!(token.chars().all(|c| c.is_ascii_hexdigit()));

        // Verify file was created
        let saved = std::fs::read_to_string(dir.join(TOKEN_FILE_NAME)).unwrap();
        assert_eq!(saved.trim(), token);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_load_or_create_token_reuses_existing() {
        let dir = std::env::temp_dir().join(format!("phonestream_test_reuse_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let known_token = "a".repeat(64);
        std::fs::write(dir.join(TOKEN_FILE_NAME), &known_token).unwrap();

        let token = load_or_create_token(&dir);
        assert_eq!(token, known_token);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_load_or_create_token_regenerates_invalid() {
        let dir = std::env::temp_dir().join(format!("phonestream_test_invalid_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        // Write an invalid token (too short)
        std::fs::write(dir.join(TOKEN_FILE_NAME), "too_short").unwrap();

        let token = load_or_create_token(&dir);
        assert_eq!(token.len(), 64);
        assert_ne!(token, "too_short");

        let _ = std::fs::remove_dir_all(&dir);
    }
}

use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::net::TcpSocket;
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::internal_api::auth::{auth_middleware, ApiState};
use crate::internal_api::handlers;

const MAX_REQUESTS_PER_SECOND: u64 = 100;

/// Simple sliding-window rate limiter using atomic counters.
struct RateLimiter {
    count: AtomicU64,
    window_start: AtomicU64,
}

impl RateLimiter {
    fn new() -> Self {
        Self {
            count: AtomicU64::new(0),
            window_start: AtomicU64::new(Self::now_secs()),
        }
    }

    fn now_secs() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    fn check(&self) -> bool {
        let now = Self::now_secs();
        let window = self.window_start.load(Ordering::Relaxed);

        if now != window {
            // New second — reset counter
            self.window_start.store(now, Ordering::Relaxed);
            self.count.store(1, Ordering::Relaxed);
            return true;
        }

        let count = self.count.fetch_add(1, Ordering::Relaxed);
        count < MAX_REQUESTS_PER_SECOND
    }
}

async fn rate_limit_middleware(
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Use a thread-local-like approach with a static
    static LIMITER: std::sync::OnceLock<RateLimiter> = std::sync::OnceLock::new();
    let limiter = LIMITER.get_or_init(RateLimiter::new);

    if !limiter.check() {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(req).await)
}

const API_PORT_START: u16 = 17395;
const API_PORT_END: u16 = 17400;
const API_HOST: &str = "127.0.0.1";

/// On Windows, kill any process holding our preferred port to avoid stale sockets.
fn kill_process_on_port(port: u16) {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("netstat")
            .args(["-ano"])
            .output();

        if let Ok(output) = output {
            let text = String::from_utf8_lossy(&output.stdout);
            let search = format!(":{}", port);

            for line in text.lines() {
                if line.contains(&search) && line.contains("LISTENING") {
                    if let Some(pid_str) = line.split_whitespace().last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            // Don't kill ourselves
                            if pid != std::process::id() {
                                eprintln!("[internal-api] Killing stale process {} on port {}", pid, port);
                                let _ = std::process::Command::new("taskkill")
                                    .args(["/F", "/PID", &pid.to_string()])
                                    .output();
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Start the internal HTTP API server on 127.0.0.1:17395.
/// This server exposes Tauri commands to the MCP server.
/// Accepts a shutdown signal to gracefully close the server and release the port.
pub async fn start_internal_api(
    state: Arc<ApiState>,
    shutdown_rx: tokio::sync::watch::Receiver<bool>,
) -> Result<(), String> {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact(
            "http://tauri.localhost".parse().unwrap(),
        ))
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ]);

    // Public routes (no auth)
    let public_routes = Router::new().route("/api/health", get(handlers::health_handler));

    // Protected routes (require Bearer token)
    let protected_routes = Router::new()
        .route("/api/screenshot", post(handlers::screenshot_handler))
        .route("/api/tap", post(handlers::tap_handler))
        .route("/api/swipe", post(handlers::swipe_handler))
        .route("/api/type", post(handlers::type_text_handler))
        .route("/api/key", post(handlers::key_press_handler))
        .route("/api/devices", get(handlers::devices_handler))
        .route("/api/device/{serial}", get(handlers::device_info_handler))
        .route("/api/display-size", post(handlers::display_size_handler))
        .route("/api/current-activity", post(handlers::current_activity_handler))
        .route("/api/run-app", post(handlers::run_app_handler))
        .route("/api/ui-tree", post(handlers::ui_tree_handler))
        .route("/api/deep-link", post(handlers::deep_link_handler))
        .route("/api/macros", get(handlers::list_macros_handler))
        .route("/api/macros/{name}", get(handlers::load_macro_handler))
        .route("/api/stream/status", get(handlers::stream_status_handler))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(middleware::from_fn(rate_limit_middleware))
        .layer(cors)
        .with_state(state);

    // Kill any stale process occupying our preferred port
    kill_process_on_port(API_PORT_START);

    // Small delay to let the OS release the socket
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // Try binding to ports in range with SO_REUSEADDR to reclaim stale sockets
    let mut listener = None;
    let mut bound_port = 0u16;
    for port in API_PORT_START..=API_PORT_END {
        let addr: std::net::SocketAddr = format!("{}:{}", API_HOST, port).parse().unwrap();
        let socket = TcpSocket::new_v4().map_err(|e| e.to_string())?;
        socket.set_reuseaddr(true).ok();
        if socket.bind(addr).is_err() {
            continue;
        }
        match socket.listen(1024) {
            Ok(l) => {
                bound_port = port;
                listener = Some(l);
                break;
            }
            Err(_) => continue,
        }
    }
    let listener = listener.ok_or(format!(
        "Failed to bind internal API on any port in range {}-{}",
        API_PORT_START, API_PORT_END
    ))?;

    eprintln!("[internal-api] Listening on http://{}:{}", API_HOST, bound_port);

    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            let mut rx = shutdown_rx;
            let _ = rx.changed().await;
            eprintln!("[internal-api] Graceful shutdown initiated");
        })
        .await
        .map_err(|e| format!("Internal API server error: {}", e))?;

    eprintln!("[internal-api] Server stopped, port released");
    Ok(())
}

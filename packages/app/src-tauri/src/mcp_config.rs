use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

/// Official Node.js download page, opened from the MCP setup guide.
const NODEJS_DOWNLOAD_URL: &str = "https://nodejs.org/en/download";

/// Stores the MCP auth token so the frontend can retrieve it.
pub struct McpToken(pub String);

/// Stores the list of project paths where MCP is configured.
pub struct ConfiguredProjects(pub std::sync::Mutex<Vec<String>>);

const CONFIGURED_PROJECTS_FILE: &str = "configured_mcp_projects.json";

// ── Tauri commands ───────────────────────────────────────────────

#[tauri::command]
pub async fn get_mcp_token(app: tauri::AppHandle) -> Result<String, String> {
    let token = app
        .try_state::<McpToken>()
        .ok_or("MCP token not available")?;
    Ok(token.0.clone())
}

#[tauri::command]
pub async fn setup_mcp_for_project(
    app: tauri::AppHandle,
    project_path: String,
) -> Result<String, String> {
    let token = app
        .try_state::<McpToken>()
        .ok_or("MCP token not available")?;

    let project_dir = PathBuf::from(&project_path);
    if !project_dir.exists() || !project_dir.is_dir() {
        return Err(format!("Directory does not exist: {}", project_path));
    }

    let mcp_entry = normalize_mcp_path(get_mcp_server_path(&app)?);
    let mcp_config = build_mcp_config(&mcp_entry, &token.0);

    // Claude Code reads project-scoped MCP servers from `.mcp.json` (not from
    // settings.local.json). The token stays local via .gitignore.
    let mcp_json_path = project_dir.join(".mcp.json");
    write_mcp_config_file(&mcp_json_path, &mcp_config)?;
    ensure_gitignored(&project_dir, ".mcp.json");
    remove_legacy_settings_entry(&project_dir);

    add_configured_project(&app, &project_path)?;

    Ok(mcp_json_path.to_string_lossy().to_string())
}

/// Check whether `node` is available on PATH (the bundled MCP server runs on Node).
/// Returns the version string when found, or `None` when Node is missing.
#[tauri::command]
pub async fn check_node_available() -> Result<Option<String>, String> {
    match crate::commands::process_utils::hidden_command("node")
        .arg("--version")
        .output()
    {
        Ok(out) if out.status.success() => {
            let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
            Ok(Some(if version.is_empty() {
                "installed".to_string()
            } else {
                version
            }))
        }
        _ => Ok(None),
    }
}

/// Open the official Node.js download page in the default browser.
#[tauri::command]
pub async fn open_nodejs_download(app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(NODEJS_DOWNLOAD_URL, None::<&str>)
        .map_err(|e| format!("Failed to open download page: {}", e))
}

#[tauri::command]
pub async fn get_configured_projects(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let state = app
        .try_state::<ConfiguredProjects>()
        .ok_or("Configured projects not available")?;
    let projects = state.0.lock().map_err(|e| e.to_string())?;
    Ok(projects.clone())
}

#[tauri::command]
pub async fn remove_configured_project(
    app: tauri::AppHandle,
    project_path: String,
) -> Result<(), String> {
    let state = app
        .try_state::<ConfiguredProjects>()
        .ok_or("Configured projects not available")?;
    {
        let mut projects = state.0.lock().map_err(|e| e.to_string())?;
        projects.retain(|p| p != &project_path);
    }
    save_configured_projects(&app)?;
    Ok(())
}

#[tauri::command]
pub async fn check_mcp_installed_at(project_path: String) -> Result<bool, String> {
    let mcp_json_path = PathBuf::from(&project_path).join(".mcp.json");
    check_mcp_in_file(&mcp_json_path)
}

#[tauri::command]
pub async fn check_mcp_installed(app: tauri::AppHandle) -> Result<bool, String> {
    let state = app
        .try_state::<ConfiguredProjects>()
        .ok_or("Configured projects not available")?;
    let projects = state.0.lock().map_err(|e| e.to_string())?;
    Ok(!projects.is_empty())
}

// ── Helpers ──────────────────────────────────────────────────────

fn get_mcp_server_path(app: &tauri::AppHandle) -> Result<String, String> {
    // Installed app: the self-contained MCP server is bundled as a resource.
    if let Ok(bundled) = app
        .path()
        .resolve("mcp-server/index.js", tauri::path::BaseDirectory::Resource)
    {
        if bundled.exists() {
            return Ok(bundled.to_string_lossy().to_string());
        }
    }

    // Dev: run the MCP server straight from the workspace build output.
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Cannot find exe path: {}", e))?;
    let project_root = find_project_root(&exe_path).ok_or(
        "MCP server not found. In development, run \"pnpm build:mcp\" from the repo root.",
    )?;
    Ok(project_root
        .join("packages/mcp-server/dist/index.js")
        .to_string_lossy()
        .to_string())
}

fn build_mcp_config(mcp_entry: &str, token: &str) -> serde_json::Value {
    serde_json::json!({
        "type": "stdio",
        "command": "node",
        "args": [mcp_entry],
        "env": {
            "MIRROR_MIND_TOKEN": token
        }
    })
}

/// Strip the Windows extended-length path prefix (`\\?\`) that `resolve` may
/// return. Node.js rejects paths carrying this prefix.
fn normalize_mcp_path(path: String) -> String {
    path.strip_prefix(r"\\?\").map(str::to_string).unwrap_or(path)
}

/// Ensure `entry` is listed in the project's `.gitignore` so the file (which
/// carries the auth token) is never committed. Creates `.gitignore` if absent.
fn ensure_gitignored(project_dir: &std::path::Path, entry: &str) {
    let gitignore = project_dir.join(".gitignore");
    let existing = std::fs::read_to_string(&gitignore).unwrap_or_default();
    if existing.lines().any(|line| line.trim() == entry) {
        return;
    }
    let mut content = existing;
    if !content.is_empty() && !content.ends_with('\n') {
        content.push('\n');
    }
    content.push_str(&format!("\n# MirrorMind MCP config (contains a local auth token)\n{}\n", entry));
    let _ = std::fs::write(&gitignore, content);
}

/// Remove the legacy `mirror-mind` entry from `.claude/settings.local.json`.
/// Older versions wrote the server there, but Claude Code never read it.
fn remove_legacy_settings_entry(project_dir: &std::path::Path) {
    let path = project_dir.join(".claude").join("settings.local.json");
    let Ok(content) = std::fs::read_to_string(&path) else {
        return;
    };
    let Ok(mut settings) = serde_json::from_str::<serde_json::Value>(&content) else {
        return;
    };
    let removed = settings
        .get_mut("mcpServers")
        .and_then(|s| s.as_object_mut())
        .map(|servers| servers.remove("mirror-mind").is_some())
        .unwrap_or(false);
    if removed {
        if let Ok(formatted) = serde_json::to_string_pretty(&settings) {
            let _ = std::fs::write(&path, formatted);
        }
    }
}

fn write_mcp_config_file(
    settings_path: &std::path::Path,
    mcp_config: &serde_json::Value,
) -> Result<(), String> {
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create directory: {}", e))?;
    }

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(settings_path)
            .map_err(|e| format!("Cannot read settings: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    settings
        .as_object_mut()
        .ok_or("Invalid settings format")?
        .entry("mcpServers")
        .or_insert(serde_json::json!({}))
        .as_object_mut()
        .ok_or("Invalid mcpServers format")?
        .insert("mirror-mind".to_string(), mcp_config.clone());

    let formatted = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Cannot serialize settings: {}", e))?;

    std::fs::write(settings_path, &formatted)
        .map_err(|e| format!("Cannot write settings: {}", e))?;

    Ok(())
}

fn check_mcp_in_file(settings_path: &std::path::Path) -> Result<bool, String> {
    if !settings_path.exists() {
        return Ok(false);
    }
    let content = std::fs::read_to_string(settings_path)
        .map_err(|e| format!("Cannot read settings: {}", e))?;
    let settings: serde_json::Value =
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}));
    Ok(settings
        .get("mcpServers")
        .and_then(|s| s.get("mirror-mind"))
        .is_some())
}

pub fn find_project_root(exe_path: &std::path::Path) -> Option<PathBuf> {
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("pnpm-workspace.yaml").exists() {
            return Some(cwd);
        }
    }

    let mut dir = exe_path.parent();
    while let Some(d) = dir {
        if d.join("pnpm-workspace.yaml").exists() {
            return Some(d.to_path_buf());
        }
        dir = d.parent();
    }

    None
}

// ── Configured projects persistence ─────────────────────────────

fn get_projects_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot get app data dir: {}", e))?;
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Cannot create app data dir: {}", e))?;
    Ok(app_data_dir.join(CONFIGURED_PROJECTS_FILE))
}

pub fn load_configured_projects(app: &tauri::AppHandle) -> Vec<String> {
    let path = match get_projects_file_path(app) {
        Ok(p) => p,
        Err(_) => return vec![],
    };
    if !path.exists() {
        return vec![];
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_configured_projects(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app
        .try_state::<ConfiguredProjects>()
        .ok_or("Configured projects not available")?;
    let projects = state.0.lock().map_err(|e| e.to_string())?;
    let path = get_projects_file_path(app)?;
    let content = serde_json::to_string_pretty(&*projects)
        .map_err(|e| format!("Cannot serialize projects: {}", e))?;
    std::fs::write(&path, &content)
        .map_err(|e| format!("Cannot write projects file: {}", e))?;
    Ok(())
}

fn add_configured_project(app: &tauri::AppHandle, project_path: &str) -> Result<(), String> {
    let state = app
        .try_state::<ConfiguredProjects>()
        .ok_or("Configured projects not available")?;
    {
        let mut projects = state.0.lock().map_err(|e| e.to_string())?;
        if !projects.contains(&project_path.to_string()) {
            projects.push(project_path.to_string());
        }
    }
    save_configured_projects(app)?;
    Ok(())
}

/// Update the MCP token in a JSON file.
pub fn update_token_in_file(token: &str, file_path: &std::path::Path) -> bool {
    if !file_path.exists() {
        return false;
    }

    let content = match std::fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(_) => return false,
    };

    let mut settings: serde_json::Value = match serde_json::from_str(&content) {
        Ok(s) => s,
        Err(_) => return false,
    };

    if let Some(mm_token) = settings
        .get_mut("mcpServers")
        .and_then(|s| s.get_mut("mirror-mind"))
        .and_then(|s| s.get_mut("env"))
        .and_then(|s| s.get_mut("MIRROR_MIND_TOKEN"))
    {
        *mm_token = serde_json::Value::String(token.to_string());
        if let Ok(formatted) = serde_json::to_string_pretty(&settings) {
            if std::fs::write(file_path, &formatted).is_ok() {
                eprintln!(
                    "[mcp] Updated token in {}",
                    file_path.display()
                );
                return true;
            }
        }
    }

    false
}

/// Update the MCP token in all configured project settings files.
pub fn update_token_in_all_projects(token: &str, projects: &[String]) {
    for project_path in projects {
        let project_dir = PathBuf::from(project_path);
        update_token_in_file(token, &project_dir.join(".mcp.json"));
    }
}

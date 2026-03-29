use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use super::settings::{get_hugo_path, AppSettings};

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

pub struct HugoProcess {
    pub child: Mutex<Option<std::process::Child>>,
    pub port: Mutex<u16>,
}

impl Default for HugoProcess {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            port: Mutex::new(1313),
        }
    }
}

#[tauri::command]
pub async fn hugo_server(
    project_path: String,
    base_url: Option<String>,
    state: State<'_, HugoProcess>,
    settings_state: State<'_, Mutex<AppSettings>>,
) -> Result<u16, String> {
    // Check if already running
    {
        let child = state.child.lock().map_err(|e| e.to_string())?;
        if child.is_some() {
            let port = state.port.lock().map_err(|e| e.to_string())?;
            return Ok(*port);
        }
    }

    // Get settings in a scoped block to ensure lock is released
    let (hugo_path, default_port, auto_refresh, open_in_browser) = {
        let settings = settings_state.lock().map_err(|e| e.to_string())?;
        let hugo_path = get_hugo_path(&*settings);
        let default_port = settings.preview.default_port;
        let auto_refresh = settings.preview.auto_refresh;
        let open_in_browser = settings.preview.open_in_browser;
        (hugo_path, default_port, auto_refresh, open_in_browser)
    };

    // Find a free port, starting from configured default port
    let port = find_free_port_starting_from(default_port);

    // Build command arguments based on settings
    // Use provided base_url (for GitHub Pages subdirectory support) or default localhost
    let default_base_url = format!("http://127.0.0.1:{}", port);
    let effective_base_url = base_url.unwrap_or(default_base_url);

    let mut args = vec![
        "server".to_string(),
        "--port".to_string(),
        port.to_string(),
        "--bind".to_string(),
        "127.0.0.1".to_string(),
        "--baseURL".to_string(),
        effective_base_url,
        "--appendPort=false".to_string(),
    ];

    // Add --buildDrafts if autoRefresh is enabled
    if auto_refresh {
        args.push("--buildDrafts".to_string());
    }

    // Start hugo server - capture stderr to report errors
    let mut child = Command::new(&hugo_path)
        .current_dir(&project_path)
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start hugo server: {}. Please check your Hugo path in Settings.", e))?;

    // Wait a moment to see if the process exits immediately with an error
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Check if the process is still running
    match child.try_wait() {
        Ok(Some(status)) => {
            // Process exited immediately - there was an error
            let mut stderr = String::new();
            if let Some(ref mut err) = child.stderr {
                use std::io::Read;
                let _ = err.read_to_string(&mut stderr);
            }

            // Check for theme/module not found error
            if let Some(theme_name) = extract_missing_theme(&stderr) {
                return Err(format!("THEME_MISSING:{}:{}", theme_name, stderr.trim()));
            }

            let error_msg = if stderr.is_empty() {
                format!("Hugo server exited with status: {}", status)
            } else {
                format!("Hugo server error: {}", stderr)
            };
            return Err(error_msg);
        }
        Ok(None) => {
            // Process is still running - good!
        }
        Err(e) => {
            return Err(format!("Failed to check hugo server status: {}", e));
        }
    }

    // Store the process
    {
        let mut c = state.child.lock().map_err(|e| e.to_string())?;
        *c = Some(child);
    }
    {
        let mut p = state.port.lock().map_err(|e| e.to_string())?;
        *p = port;
    }

    // Wait for server to be ready (with shorter timeout since we know it's running)
    let port_to_check = port;
    let server_ready = tokio::spawn(async move {
        wait_for_server(port_to_check, 5).await
    }).await.map_err(|e| format!("Failed to wait for server: {}", e))?;

    if !server_ready {
        // Kill the process if it didn't start properly
        let mut child = state.child.lock().map_err(|e| e.to_string())?;
        if let Some(mut c) = child.take() {
            let _ = c.kill();
        }
        return Err(format!("Hugo server failed to start on port {} within 5 seconds. The site may have build errors.", port));
    }

    // Open browser if configured
    if open_in_browser {
        let url = format!("http://127.0.0.1:{}", port);
        tokio::spawn(async move {
            // Wait a moment for the server to start
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            if let Err(e) = open::that(&url) {
                eprintln!("Failed to open browser: {}", e);
            }
        });
    }

    Ok(port)
}

#[tauri::command]
pub async fn stop_hugo_server(state: State<'_, HugoProcess>) -> Result<(), String> {
    let mut child = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(mut c) = child.take() {
        let _ = c.kill();
    }
    Ok(())
}

#[tauri::command]
pub async fn hugo_build(
    project_path: String,
    settings_state: State<'_, Mutex<AppSettings>>,
) -> Result<CommandOutput, String> {
    let settings = settings_state.lock().map_err(|e| e.to_string())?;
    let hugo_path = get_hugo_path(&*settings);

    let output = Command::new(&hugo_path)
        .current_dir(&project_path)
        .arg("--gc")
        .arg("--minify")
        .arg("--buildDrafts")
        .output()
        .map_err(|e| format!("Failed to run hugo build: {}", e))?;

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    })
}

#[tauri::command]
pub async fn hugo_new_content(
    project_path: String,
    content_path: String,
    archetype: Option<String>,
    settings_state: State<'_, Mutex<AppSettings>>,
) -> Result<CommandOutput, String> {
    let settings = settings_state.lock().map_err(|e| e.to_string())?;
    let hugo_path = get_hugo_path(&*settings);

    let mut cmd = Command::new(&hugo_path);
    cmd.current_dir(&project_path)
        .arg("new")
        .arg("content")
        .arg(&content_path);

    if let Some(arc) = archetype {
        cmd.arg("--kind").arg(arc);
    }

    let output = cmd.output().map_err(|e| format!("Failed to create content: {}", e))?;

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    })
}

#[tauri::command]
pub async fn execute_command(
    project_path: String,
    command: String,
    args: Vec<String>,
    settings_state: State<'_, Mutex<AppSettings>>,
) -> Result<CommandOutput, String> {
    // If command is "hugo", use the configured hugo path
    let effective_command = if command == "hugo" || command == "hugo.exe" {
        let settings = settings_state.lock().map_err(|e| e.to_string())?;
        get_hugo_path(&*settings)
    } else {
        command
    };

    let output = Command::new(&effective_command)
        .current_dir(&project_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute command '{}': {}", effective_command, e))?;

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    })
}

fn find_free_port_starting_from(start_port: u16) -> u16 {
    // Try to find a free port starting from configured default port
    for port in start_port..start_port + 100 {
        if is_port_free(port) {
            return port;
        }
    }
    // Fallback to default range if configured port and next 100 are all taken
    for port in 1313..1400 {
        if is_port_free(port) {
            return port;
        }
    }
    0 // Return 0 if no port found (will cause an error)
}

fn is_port_free(port: u16) -> bool {
    std::net::TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
}

/// Extract missing theme name from Hugo error output
fn extract_missing_theme(stderr: &str) -> Option<String> {
    // Pattern 1: module "theme-name" not found
    let re1 = regex::Regex::new(r#"module\s+"([^"]+)"\s+not found"#).ok()?;
    if let Some(caps) = re1.captures(stderr) {
        return caps.get(1).map(|m| m.as_str().to_string());
    }

    // Pattern 2: Unable to locate theme directory
    if stderr.contains("Unable to locate theme directory") ||
       stderr.contains("could not locate theme") {
        return Some("(未配置或不存在)".to_string());
    }

    // Pattern 3: no theme set (blank theme configuration)
    if stderr.contains("no theme") || stderr.contains("theme not set") {
        return Some("(未设置)".to_string());
    }

    None
}

async fn wait_for_server(port: u16, timeout_secs: u64) -> bool {
    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(timeout_secs);
    let client = reqwest::Client::new();

    while start.elapsed() < timeout {
        // Try to make an HTTP request to the server
        match client.get(format!("http://127.0.0.1:{}/", port))
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
        {
            Ok(response) => {
                // Server is responding, check if it's returning a valid response
                // (either 200 OK or 404 is fine, just means server is ready)
                let status = response.status();
                if status.is_success() || status.as_u16() == 404 {
                    return true;
                }
            }
            Err(_) => {
                // Server not ready yet, wait and retry
            }
        }
        // Wait a bit before retrying
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    false
}

/// Open preview window for Hugo server
#[tauri::command]
pub async fn open_preview_window(
    port: u16,
    app: AppHandle,
    _state: State<'_, HugoProcess>,
) -> Result<(), String> {
    // Check if preview window already exists, if so, just focus it
    if let Some(window) = app.get_webview_window("preview") {
        let _ = window.set_focus();
        return Ok(());
    }

    // Parse the URL
    let url: tauri::Url = format!("http://127.0.0.1:{}", port)
        .parse()
        .map_err(|e| format!("Failed to parse URL: {}", e))?;

    // Create new preview window
    let window = WebviewWindowBuilder::new(&app, "preview", WebviewUrl::External(url))
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .title("预览窗口")
        .build()
        .map_err(|e| format!("Failed to create preview window: {}", e))?;

    // Listen for window close event to stop Hugo server
    let app_clone = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            // Stop Hugo server when preview window is closed
            if let Some(state) = app_clone.try_state::<HugoProcess>() {
                if let Ok(mut child) = state.child.lock() {
                    if let Some(mut c) = child.take() {
                        let _ = c.kill();
                    }
                }
            }
            // Notify frontend that preview has stopped
            let _ = app_clone.emit("preview-window-closed", ());
        }
    });

    Ok(())
}

/// Close preview window if it exists
#[tauri::command]
pub async fn close_preview_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("preview") {
        let _ = window.close();
    }
    Ok(())
}

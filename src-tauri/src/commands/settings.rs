use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PreviewSettings {
    pub auto_refresh: bool,
    pub default_port: u16,
    pub open_in_browser: bool,
}

impl Default for PreviewSettings {
    fn default() -> Self {
        Self {
            auto_refresh: true,
            default_port: 1313,
            open_in_browser: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub hugo_path: Option<String>,
    pub preview: PreviewSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            hugo_path: None,
            preview: PreviewSettings::default(),
        }
    }
}

/// Verify if the given Hugo path is valid and return version
#[tauri::command]
pub async fn verify_hugo_path(hugo_path: String) -> Result<String, String> {
    let output = Command::new(&hugo_path)
        .arg("version")
        .output()
        .map_err(|e| format!("Failed to run hugo: {}", e))?;

    if !output.status.success() {
        return Err("Hugo returned an error".to_string());
    }

    let version = String::from_utf8_lossy(&output.stdout);
    Ok(version.to_string())
}

/// Try to auto-detect Hugo in common locations
#[tauri::command]
pub async fn detect_hugo_path() -> Result<Option<String>, String> {
    // First try to find Hugo in system PATH and get full path
    if let Ok(output) = Command::new("hugo").arg("version").output() {
        if output.status.success() {
            // Try to get the full path using `which` (Unix) or `where` (Windows)
            let full_path = if cfg!(target_os = "windows") {
                Command::new("where")
                    .arg("hugo")
                    .output()
                    .ok()
                    .and_then(|out| {
                        if out.status.success() {
                            String::from_utf8(out.stdout)
                                .ok()
                                .map(|s| s.lines().next().unwrap_or("hugo").trim().to_string())
                        } else {
                            None
                        }
                    })
            } else {
                Command::new("which")
                    .arg("hugo")
                    .output()
                    .ok()
                    .and_then(|out| {
                        if out.status.success() {
                            String::from_utf8(out.stdout)
                                .ok()
                                .map(|s| s.trim().to_string())
                        } else {
                            None
                        }
                    })
            };
            return Ok(full_path.or(Some("hugo".to_string())));
        }
    }

    // Common installation paths
    let common_paths = if cfg!(target_os = "windows") {
        vec![
            r"C:\Program Files\Hugo\hugo.exe",
            r"C:\Program Files (x86)\Hugo\hugo.exe",
            r"C:\Users\%USERNAME%\AppData\Local\Hugo\hugo.exe",
            r"C:\Hugo\hugo.exe",
        ]
    } else if cfg!(target_os = "macos") {
        vec![
            "/usr/local/bin/hugo",
            "/opt/homebrew/bin/hugo",
            "/usr/bin/hugo",
            "/opt/local/bin/hugo",
        ]
    } else {
        vec![
            "/usr/local/bin/hugo",
            "/usr/bin/hugo",
            "/snap/bin/hugo",
            "/home/linuxbrew/.linuxbrew/bin/hugo",
        ]
    };

    for path in common_paths {
        let path_expanded = if path.contains('%') && cfg!(target_os = "windows") {
            // Expand Windows environment variables
            std::env::var("USERNAME")
                .map(|username| path.replace("%USERNAME%", &username))
                .unwrap_or_else(|_| path.to_string())
        } else {
            path.to_string()
        };

        let path_buf = PathBuf::from(&path_expanded);
        if path_buf.exists() {
            // Verify it's actually hugo
            if let Ok(output) = Command::new(&path_expanded).arg("version").output() {
                if output.status.success() {
                    return Ok(Some(path_expanded));
                }
            }
        }
    }

    Ok(None)
}

/// Get the effective Hugo path (custom or system default)
pub fn get_hugo_path(settings: &AppSettings) -> String {
    settings.hugo_path.clone().unwrap_or_else(|| "hugo".to_string())
}

/// Check if Hugo is available (either custom path or system PATH)
#[tauri::command]
pub async fn is_hugo_available(settings: tauri::State<'_, std::sync::Mutex<AppSettings>>) -> Result<bool, String> {
    let settings = settings.lock().map_err(|e| e.to_string())?;
    let hugo_path = get_hugo_path(&*settings);

    match Command::new(&hugo_path).arg("version").output() {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

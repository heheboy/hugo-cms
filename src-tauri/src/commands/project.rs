use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct HugoProject {
    pub id: String,
    pub name: String,
    pub path: String,
    pub config: HugoConfig,
    pub last_opened: String,
    pub hugo_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HugoConfig {
    pub title: String,
    pub base_url: Option<String>,
    pub language_code: Option<String>,
    pub theme: Option<String>,
    pub params: Option<serde_json::Value>,
}

#[tauri::command]
pub async fn open_project(path: String) -> Result<HugoProject, String> {
    let path_buf = PathBuf::from(&path);

    // Check if path exists
    if !path_buf.exists() {
        return Err("Path does not exist".to_string());
    }

    // Look for Hugo config files
    let config_files = ["hugo.toml", "hugo.yaml", "hugo.json", "config.toml", "config.yaml", "config.json"];
    let mut found_config = None;

    for config_file in &config_files {
        let config_path = path_buf.join(config_file);
        if config_path.exists() {
            found_config = Some(config_path);
            break;
        }
    }

    if found_config.is_none() {
        return Err("No Hugo configuration file found in the selected directory".to_string());
    }

    // Parse config file
    let config_content = std::fs::read_to_string(found_config.unwrap())
        .map_err(|e| e.to_string())?;

    let config: HugoConfig = match toml::from_str(&config_content) {
        Ok(c) => c,
        Err(_) => {
            // Try YAML if TOML fails
            serde_yaml::from_str(&config_content)
                .map_err(|e| format!("Failed to parse config: {}", e))?
        }
    };

    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    Ok(HugoProject {
        id: Uuid::new_v4().to_string(),
        name,
        path,
        config,
        last_opened: Utc::now().to_rfc3339(),
        hugo_version: None,
    })
}

#[tauri::command]
pub async fn detect_hugo_version() -> Result<String, String> {
    let output = std::process::Command::new("hugo")
        .arg("version")
        .output()
        .map_err(|e| format!("Failed to run hugo: {}", e))?;

    if !output.status.success() {
        return Err("Hugo is not installed or not in PATH".to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Recursively copy directory contents (needed for cross-device moves on Windows)
fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThemeInfo {
    pub name: String,
    pub version: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub source: Option<String>,
    pub is_active: bool,
    pub has_screenshot: bool,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OfficialTheme {
    pub name: String,
    pub description: String,
    pub repo: String,
    pub thumbnail: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThemeMetadata {
    pub install_method: String, // "git" or "zip"
    pub source_path: Option<String>, // Original ZIP path or Git URL
    pub install_date: String,
    pub version: Option<String>,
}

/// List all installed themes in the project's themes directory
#[tauri::command]
pub async fn list_themes(project_path: String) -> Result<Vec<ThemeInfo>, String> {
    let themes_dir = PathBuf::from(&project_path).join("themes");
    let mut themes = Vec::new();

    // Get current theme from hugo.toml
    let current_theme = get_current_theme_name(&project_path).await.ok();

    if themes_dir.exists() {
        for entry in fs::read_dir(&themes_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                // Check for screenshot
                let screenshot_path = path.join("images").join("screenshot.png");
                let has_screenshot = screenshot_path.exists();

                // Try to read theme.toml or theme.yaml for metadata
                let theme_toml = path.join("theme.toml");
                let theme_yaml = path.join("theme.yaml");

                let (description, author, version, source) = if theme_toml.exists() {
                    parse_theme_toml(&theme_toml).unwrap_or_default()
                } else if theme_yaml.exists() {
                    parse_theme_yaml(&theme_yaml).unwrap_or_default()
                } else {
                    (None, None, None, None)
                };

                themes.push(ThemeInfo {
                    name,
                    version,
                    description,
                    author,
                    source,
                    is_active: false, // Will be updated after the loop
                    has_screenshot,
                    path: path.to_string_lossy().to_string(),
                });
            }
        }
    }

    // Update is_active flag
    for theme in &mut themes {
        theme.is_active = current_theme.as_ref() == Some(&theme.name);
    }

    Ok(themes)
}

/// Get the current theme name from hugo.toml
#[tauri::command]
pub async fn get_current_theme(project_path: String) -> Result<String, String> {
    get_current_theme_name(&project_path).await
}

async fn get_current_theme_name(project_path: &str) -> Result<String, String> {
    let config_files = ["hugo.toml", "hugo.yaml", "hugo.json", "config.toml", "config.yaml", "config.json"];

    for config_file in &config_files {
        let config_path = PathBuf::from(project_path).join(config_file);
        if config_path.exists() {
            let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;

            // Try to parse theme field
            if config_file.ends_with(".toml") {
                if let Ok(value) = toml::from_str::<toml::Value>(&content) {
                    if let Some(theme) = value.get("theme").and_then(|t| t.as_str()) {
                        return Ok(theme.to_string());
                    }
                }
            } else if config_file.ends_with(".yaml") || config_file.ends_with(".yml") {
                if let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                    if let Some(theme) = value.get("theme").and_then(|t| t.as_str()) {
                        return Ok(theme.to_string());
                    }
                }
            }
        }
    }

    Err("No theme configured".to_string())
}

/// Set the current theme in hugo.toml
#[tauri::command]
pub async fn set_theme(project_path: String, theme_name: String) -> Result<(), String> {
    let config_files = ["hugo.toml", "hugo.yaml", "hugo.json", "config.toml", "config.yaml", "config.json"];

    for config_file in &config_files {
        let config_path = PathBuf::from(&project_path).join(config_file);
        if config_path.exists() {
            let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;

            let new_content = if config_file.ends_with(".toml") {
                update_toml_theme(&content, &theme_name)?
            } else if config_file.ends_with(".yaml") || config_file.ends_with(".yml") {
                update_yaml_theme(&content, &theme_name)?
            } else {
                continue;
            };

            fs::write(&config_path, new_content).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    // If no config file exists, create hugo.toml
    let config_path = PathBuf::from(&project_path).join("hugo.toml");
    let content = format!("theme = '{}'\n", theme_name);
    fs::write(&config_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

fn update_toml_theme(content: &str, theme_name: &str) -> Result<String, String> {
    let mut doc = content.parse::<toml_edit::DocumentMut>()
        .map_err(|e| format!("Failed to parse TOML: {}", e))?;

    doc["theme"] = toml_edit::value(theme_name);
    Ok(doc.to_string())
}

fn update_yaml_theme(content: &str, theme_name: &str) -> Result<String, String> {
    let mut value: serde_yaml::Value = serde_yaml::from_str(content)
        .map_err(|e| format!("Failed to parse YAML: {}", e))?;

    if let Some(map) = value.as_mapping_mut() {
        map.insert(
            serde_yaml::Value::String("theme".to_string()),
            serde_yaml::Value::String(theme_name.to_string()),
        );
    }

    serde_yaml::to_string(&value).map_err(|e| e.to_string())
}

/// Install theme from Git URL
#[tauri::command]
pub async fn install_theme_git(
    project_path: String,
    git_url: String,
    theme_name: String,
) -> Result<(), String> {
    let themes_dir = PathBuf::from(&project_path).join("themes");
    let target_dir = themes_dir.join(&theme_name);

    // Create themes directory if it doesn't exist
    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir).map_err(|e| e.to_string())?;
    }

    // Check if theme already exists
    if target_dir.exists() {
        return Err(format!("Theme '{}' already exists", theme_name));
    }

    // Clone the repository
    let output = Command::new("git")
        .args([
            "clone",
            &git_url,
            target_dir.to_str().unwrap(),
            "--depth=1",
        ])
        .output()
        .map_err(|e| format!("Failed to run git clone: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed: {}", stderr));
    }

    // Remove .git directory to save space
    let git_dir = target_dir.join(".git");
    if git_dir.exists() {
        let _ = fs::remove_dir_all(&git_dir);
    }

    // Create metadata file for Git-installed themes
    let metadata = ThemeMetadata {
        install_method: "git".to_string(),
        source_path: Some(git_url),
        install_date: chrono::Utc::now().to_rfc3339(),
        version: None,
    };

    let metadata_path = target_dir.join(".hugo-cms-metadata.json");
    let metadata_json = serde_json::to_string(&metadata).map_err(|e| e.to_string())?;
    fs::write(&metadata_path, metadata_json).map_err(|e| e.to_string())?;

    Ok(())
}

/// Uninstall a theme
#[tauri::command]
pub async fn uninstall_theme(project_path: String, theme_name: String) -> Result<(), String> {
    let theme_dir = PathBuf::from(&project_path).join("themes").join(&theme_name);

    if !theme_dir.exists() {
        return Err(format!("Theme '{}' not found", theme_name));
    }

    fs::remove_dir_all(&theme_dir).map_err(|e| format!("Failed to remove theme: {}", e))?;

    Ok(())
}

/// Install theme from ZIP file
#[tauri::command]
pub async fn install_theme_zip(
    project_path: String,
    zip_path: String,
    theme_name: String,
) -> Result<(), String> {
    install_theme_zip_internal(&project_path, zip_path, &theme_name, None).await
}

/// Download and install theme from URL
#[tauri::command]
pub async fn download_and_install_theme(
    project_path: String,
    url: String,
    theme_name: String,
) -> Result<(), String> {
    // Download the ZIP file
    let response = reqwest::get(&url).await.map_err(|e| format!("Failed to download theme: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    // Save to temporary file
    let temp_file = std::env::temp_dir().join(format!("theme-{}.zip", uuid::Uuid::new_v4()));
    let bytes = response.bytes().await.map_err(|e| format!("Failed to read download: {}", e))?;
    fs::write(&temp_file, &bytes).map_err(|e| format!("Failed to save download: {}", e))?;

    // Install from ZIP
    install_theme_zip_internal(&project_path, temp_file.to_string_lossy().to_string(), &theme_name, Some(url.clone())).await?;

    // Clean up temp file
    let _ = fs::remove_file(&temp_file);

    Ok(())
}

/// Internal function to install theme from ZIP with metadata
async fn install_theme_zip_internal(
    project_path: &str,
    zip_path: String,
    theme_name: &str,
    source_url: Option<String>,
) -> Result<(), String> {
    use std::io::Read;
    use zip::read::ZipArchive;

    let themes_dir = PathBuf::from(project_path).join("themes");
    let target_dir = themes_dir.join(theme_name);

    // Create themes directory if it doesn't exist
    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir).map_err(|e| e.to_string())?;
    }

    // Check if theme already exists
    if target_dir.exists() {
        return Err(format!("Theme '{}' already exists", theme_name));
    }

    // Open and extract ZIP file
    let file = fs::File::open(&zip_path).map_err(|e| format!("Failed to open ZIP file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP file: {}", e))?;

    // Find the root directory in the ZIP (usually theme-name-master/ or theme-name-main/)
    let mut root_dir: Option<String> = None;
    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name();
        if name.contains('/') && !name.starts_with("__") {
            root_dir = Some(name.split('/').next().unwrap_or("").to_string());
            break;
        }
    }

    // Create a temporary extraction directory
    let temp_dir = std::env::temp_dir().join(format!("hugo-theme-{}-{}", theme_name, uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name();

        // Skip macOS system files and root directory entries
        if name.starts_with("__MACOSX") || name.ends_with('/') {
            continue;
        }

        // Remove root directory prefix if present
        let relative_path = match &root_dir {
            Some(root) if name.starts_with(root) => name[root.len()..].trim_start_matches('/'),
            _ => name,
        };

        if relative_path.is_empty() {
            continue;
        }

        let out_path = temp_dir.join(relative_path);

        // Create parent directories
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        // Extract file
        let mut outfile = fs::File::create(&out_path).map_err(|e| e.to_string())?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
        outfile.write_all(&buffer).map_err(|e| e.to_string())?;
    }

    // Move extracted content to themes directory
    // Use copy + remove instead of rename to support cross-device moves on Windows
    copy_dir_all(&temp_dir, &target_dir).map_err(|e| format!("Failed to copy theme: {}", e))?;

    // Clean up temp directory
    fs::remove_dir_all(&temp_dir).map_err(|e| format!("Failed to clean up temp directory: {}", e))?;

    // Create metadata file
    let metadata = ThemeMetadata {
        install_method: if source_url.is_some() { "download".to_string() } else { "zip".to_string() },
        source_path: source_url.or(Some(zip_path)),
        install_date: chrono::Utc::now().to_rfc3339(),
        version: None,
    };

    let metadata_path = target_dir.join(".hugo-cms-metadata.json");
    let metadata_json = serde_json::to_string(&metadata).map_err(|e| e.to_string())?;
    fs::write(&metadata_path, metadata_json).map_err(|e| e.to_string())?;

    Ok(())
}

/// Install theme from local folder
#[tauri::command]
pub async fn install_theme_folder(
    project_path: String,
    folder_path: String,
    theme_name: String,
) -> Result<(), String> {
    let themes_dir = PathBuf::from(&project_path).join("themes");
    let source_dir = PathBuf::from(&folder_path);
    let target_dir = themes_dir.join(&theme_name);

    // Check if source folder exists
    if !source_dir.exists() {
        return Err(format!("Source folder '{}' does not exist", folder_path));
    }

    if !source_dir.is_dir() {
        return Err(format!("'{}' is not a directory", folder_path));
    }

    // Create themes directory if it doesn't exist
    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir).map_err(|e| e.to_string())?;
    }

    // Check if theme already exists
    if target_dir.exists() {
        return Err(format!("Theme '{}' already exists", theme_name));
    }

    // Copy folder contents to themes directory
    copy_dir_all(&source_dir, &target_dir).map_err(|e| format!("Failed to copy theme folder: {}", e))?;

    // Create metadata file
    let metadata = ThemeMetadata {
        install_method: "folder".to_string(),
        source_path: Some(folder_path),
        install_date: chrono::Utc::now().to_rfc3339(),
        version: None,
    };

    let metadata_path = target_dir.join(".hugo-cms-metadata.json");
    let metadata_json = serde_json::to_string(&metadata).map_err(|e| e.to_string())?;
    fs::write(&metadata_path, metadata_json).map_err(|e| e.to_string())?;

    Ok(())
}

/// Get official themes from Hugo themes website
#[tauri::command]
pub async fn get_official_themes() -> Result<Vec<OfficialTheme>, String> {
    // Since we can't easily fetch from themes.gohugo.io (it doesn't have a simple JSON API),
    // we'll return a curated list of popular themes
    let themes = vec![
        OfficialTheme {
            name: "ananke".to_string(),
            description: "A multilingual and customizable theme for Hugo".to_string(),
            repo: "https://github.com/theNewDynamic/gohugo-theme-ananke".to_string(),
            thumbnail: "https://raw.githubusercontent.com/theNewDynamic/gohugo-theme-ananke/master/images/screenshot.png".to_string(),
            tags: vec!["blog".to_string(), "responsive".to_string(), "multilingual".to_string()],
        },
        OfficialTheme {
            name: "paperMod".to_string(),
            description: "A fast, clean, responsive Hugo theme".to_string(),
            repo: "https://github.com/adityatelange/hugo-PaperMod".to_string(),
            thumbnail: "https://raw.githubusercontent.com/adityatelange/hugo-PaperMod/master/images/screenshot.png".to_string(),
            tags: vec!["blog".to_string(), "minimal".to_string(), "fast".to_string()],
        },
        OfficialTheme {
            name: "hugo-book".to_string(),
            description: "Hugo documentation theme as simple as plain book".to_string(),
            repo: "https://github.com/alex-shpak/hugo-book".to_string(),
            thumbnail: "https://raw.githubusercontent.com/alex-shpak/hugo-book/master/images/screenshot.png".to_string(),
            tags: vec!["documentation".to_string(), "minimal".to_string(), "clean".to_string()],
        },
        OfficialTheme {
            name: "docsy".to_string(),
            description: "A Hugo theme for technical documentation sites".to_string(),
            repo: "https://github.com/google/docsy".to_string(),
            thumbnail: "https://www.docsy.dev/images/featurette-docs.png".to_string(),
            tags: vec!["documentation".to_string(), "professional".to_string(), "google".to_string()],
        },
        OfficialTheme {
            name: "blowfish".to_string(),
            description: "A powerful, lightweight theme for Hugo".to_string(),
            repo: "https://github.com/nunocoracao/blowfish".to_string(),
            thumbnail: "https://raw.githubusercontent.com/nunocoracao/blowfish/main/images/screenshot.png".to_string(),
            tags: vec!["blog".to_string(), "responsive".to_string(), "modern".to_string()],
        },
        OfficialTheme {
            name: "stack".to_string(),
            description: "Card-style Hugo theme designed for bloggers".to_string(),
            repo: "https://github.com/CaiJimmy/hugo-theme-stack".to_string(),
            thumbnail: "https://raw.githubusercontent.com/CaiJimmy/hugo-theme-stack/master/images/screenshot.png".to_string(),
            tags: vec!["blog".to_string(), "card".to_string(), "modern".to_string()],
        },
        OfficialTheme {
            name: "toha".to_string(),
            description: "A Hugo theme for personal portfolio".to_string(),
            repo: "https://github.com/hugo-toha/toha".to_string(),
            thumbnail: "https://raw.githubusercontent.com/hugo-toha/toha/main/images/screenshot.png".to_string(),
            tags: vec!["portfolio".to_string(), "personal".to_string(), "responsive".to_string()],
        },
        OfficialTheme {
            name: "loveit".to_string(),
            description: "A clean, elegant but advanced blog theme for Hugo".to_string(),
            repo: "https://github.com/dillonzq/LoveIt".to_string(),
            thumbnail: "https://raw.githubusercontent.com/dillonzq/LoveIt/master/images/screenshot.png".to_string(),
            tags: vec!["blog".to_string(), "elegant".to_string(), "feature-rich".to_string()],
        },
    ];

    Ok(themes)
}

/// Parse theme.toml for metadata
fn parse_theme_toml(path: &PathBuf) -> Result<(Option<String>, Option<String>, Option<String>, Option<String>), String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let value: toml::Value = toml::from_str(&content).map_err(|e| e.to_string())?;

    let description = value.get("description")
        .and_then(|d| d.as_str())
        .map(|s| s.to_string());

    let author = value.get("author")
        .and_then(|a| a.as_str())
        .or_else(|| {
            value.get("authors")
                .and_then(|a| a.as_array())
                .and_then(|arr| arr.first())
                .and_then(|a| a.as_str())
        })
        .map(|s| s.to_string());

    let version = value.get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let source = value.get("homepage")
        .or_else(|| value.get("source"))
        .and_then(|s| s.as_str())
        .map(|s| s.to_string());

    Ok((description, author, version, source))
}

/// Parse theme.yaml for metadata
fn parse_theme_yaml(path: &PathBuf) -> Result<(Option<String>, Option<String>, Option<String>, Option<String>), String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let value: serde_yaml::Value = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let description = value.get("description")
        .and_then(|d| d.as_str())
        .map(|s| s.to_string());

    let author = value.get("author")
        .and_then(|a| a.as_str())
        .or_else(|| {
            value.get("authors")
                .and_then(|a| a.as_sequence())
                .and_then(|arr| arr.first())
                .and_then(|a| a.as_str())
        })
        .map(|s| s.to_string());

    let version = value.get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let source = value.get("homepage")
        .or_else(|| value.get("source"))
        .and_then(|s| s.as_str())
        .map(|s| s.to_string());

    Ok((description, author, version, source))
}

/// Check for theme updates
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThemeUpdateInfo {
    pub name: String,
    pub current_version: Option<String>,
    pub latest_version: Option<String>,
    pub has_update: bool,
    pub source: Option<String>,
}

#[tauri::command]
pub async fn check_theme_updates(project_path: String) -> Result<Vec<ThemeUpdateInfo>, String> {
    let themes = list_themes(project_path.clone()).await?;
    let mut updates = Vec::new();

    for theme in themes {
        let theme_path = PathBuf::from(&project_path).join("themes").join(&theme.name);
        let git_dir = theme_path.join(".git");

        // Read metadata if exists
        let metadata_path = theme_path.join(".hugo-cms-metadata.json");
        let metadata: Option<ThemeMetadata> = if metadata_path.exists() {
            fs::read_to_string(&metadata_path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
        } else {
            None
        };

        let (has_update, latest_version) = if git_dir.exists() {
            // Git-installed theme
            match check_git_updates(&theme_path).await {
                Ok((local, remote)) => {
                    let has_update = local != remote && remote.is_some();
                    let latest = if has_update {
                        get_latest_version(&theme_path).await.ok()
                    } else {
                        theme.version.clone()
                    };
                    (has_update, latest)
                }
                Err(_) => (false, theme.version.clone()),
            }
        } else if let Some(ref meta) = metadata {
            // ZIP/Download-installed theme
            if let Some(ref source) = meta.source_path {
                if source.starts_with("http") {
                    // Check HTTP source for updates
                    match check_http_updates(source).await {
                        Ok(has_update) => (has_update, Some("New version available".to_string())),
                        Err(_) => (false, theme.version.clone()),
                    }
                } else {
                    // Local ZIP file - can't check updates
                    (false, theme.version.clone())
                }
            } else {
                (false, theme.version.clone())
            }
        } else {
            // No metadata and no git - can't check updates
            (false, theme.version.clone())
        };

        updates.push(ThemeUpdateInfo {
            name: theme.name,
            current_version: theme.version,
            latest_version,
            has_update,
            source: theme.source,
        });
    }

    Ok(updates)
}

async fn check_http_updates(url: &str) -> Result<bool, String> {
    // For HTTP URLs, we can only check if the file has changed
    // by making a HEAD request and comparing ETag or Last-Modified
    // For now, we'll just return false (no update) as a safe default
    // A more sophisticated implementation would store and compare ETag

    // Optional: Make HEAD request to check if resource exists
    let response = reqwest::Client::new()
        .head(url)
        .send()
        .await
        .map_err(|e| format!("Failed to check updates: {}", e))?;

    // If the URL is accessible, we assume there might be an update
    // In a real implementation, you'd store the ETag and compare
    Ok(response.status().is_success())
}

async fn check_git_updates(theme_path: &PathBuf) -> Result<(Option<String>, Option<String>), String> {
    // Fetch from remote
    let _fetch_output = Command::new("git")
        .current_dir(theme_path)
        .args(["fetch", "--dry-run"])
        .output()
        .map_err(|e| format!("Failed to fetch: {}", e))?;

    // Get local HEAD
    let local_output = Command::new("git")
        .current_dir(theme_path)
        .args(["rev-parse", "HEAD"])
        .output()
        .map_err(|e| format!("Failed to get local version: {}", e))?;

    let local = String::from_utf8_lossy(&local_output.stdout).trim().to_string();

    // Get remote HEAD
    let remote_output = Command::new("git")
        .current_dir(theme_path)
        .args(["rev-parse", "@{u}"])
        .output()
        .map_err(|e| format!("Failed to get remote version: {}", e))?;

    let remote = String::from_utf8_lossy(&remote_output.stdout).trim().to_string();

    Ok((
        Some(local),
        if remote.is_empty() { None } else { Some(remote) },
    ))
}

async fn get_latest_version(theme_path: &PathBuf) -> Result<String, String> {
    // Try to get the latest tag
    let output = Command::new("git")
        .current_dir(theme_path)
        .args(["describe", "--tags", "--abbrev=0"])
        .output()
        .map_err(|e| format!("Failed to get latest version: {}", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !version.is_empty() {
            return Ok(version);
        }
    }

    // Fallback to short commit hash
    let output = Command::new("git")
        .current_dir(theme_path)
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .map_err(|e| format!("Failed to get commit: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Update a theme to the latest version
#[tauri::command]
pub async fn update_theme(project_path: String, theme_name: String) -> Result<String, String> {
    let theme_path = PathBuf::from(&project_path).join("themes").join(&theme_name);
    let git_dir = theme_path.join(".git");

    if git_dir.exists() {
        // Git-installed theme - pull latest changes
        let output = Command::new("git")
            .current_dir(&theme_path)
            .args(["pull", "--rebase"])
            .output()
            .map_err(|e| format!("Failed to pull updates: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(format!("Theme '{}' updated successfully", theme_name))
    } else {
        // Check for metadata to see if it's a downloaded theme
        let metadata_path = theme_path.join(".hugo-cms-metadata.json");
        if metadata_path.exists() {
            let metadata: ThemeMetadata = fs::read_to_string(&metadata_path)
                .map_err(|e| e.to_string())
                .and_then(|content| serde_json::from_str(&content).map_err(|e| e.to_string()))?;

            if let Some(source_url) = metadata.source_path {
                if source_url.starts_with("http") {
                    // Delete old theme
                    fs::remove_dir_all(&theme_path)
                        .map_err(|e| format!("Failed to remove old theme: {}", e))?;

                    // Re-download and install
                    download_and_install_theme(project_path, source_url, theme_name.clone()).await?;

                    Ok(format!("Theme '{}' re-downloaded and updated successfully", theme_name))
                } else {
                    Err("Cannot update local ZIP theme. Please reinstall manually.".to_string())
                }
            } else {
                Err("Theme has no source information, cannot update".to_string())
            }
        } else {
            Err("Theme is not a git repository and has no metadata, cannot update".to_string())
        }
    }
}

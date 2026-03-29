use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub file_type: String, // "file", "directory", or "error"
    pub children: Option<Vec<FileNode>>,
    pub error: Option<String>, // Error message if file_type is "error"
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<FileNode>, String> {
    let mut entries = Vec::new();

    for entry_result in WalkDir::new(&path)
        .max_depth(1)
        .into_iter()
    {
        let entry = match entry_result {
            Ok(e) => e,
            Err(e) => {
                // Create an error node for this failed entry
                let error_path = e.path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                let error_name = e.path()
                    .and_then(|p| p.file_name())
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                entries.push(FileNode {
                    name: error_name,
                    path: error_path,
                    file_type: "error".to_string(),
                    children: None,
                    error: Some(format!("Failed to read entry: {}", e)),
                });
                continue;
            }
        };

        if entry.path() == Path::new(&path) {
            continue;
        }

        // Try to get metadata, handle errors gracefully
        match entry.metadata() {
            Ok(metadata) => {
                let file_type = if metadata.is_dir() {
                    "directory"
                } else {
                    "file"
                };

                entries.push(FileNode {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: entry.path().to_string_lossy().to_string(),
                    file_type: file_type.to_string(),
                    children: None,
                    error: None,
                });
            }
            Err(e) => {
                // Can't read metadata - create an error node
                entries.push(FileNode {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: entry.path().to_string_lossy().to_string(),
                    file_type: "error".to_string(),
                    children: None,
                    error: Some(format!("Permission denied or access error: {}", e)),
                });
            }
        }
    }

    Ok(entries)
}

#[tauri::command]
pub async fn build_file_tree(path: String) -> Result<Vec<FileNode>, String> {
    build_tree_recursive(&path, 10)
}

fn build_tree_recursive(path: &str, max_depth: usize) -> Result<Vec<FileNode>, String> {
    if max_depth == 0 {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();

    for entry_result in WalkDir::new(path)
        .max_depth(1)
        .into_iter()
    {
        let entry = match entry_result {
            Ok(e) => e,
            Err(e) => {
                // Create an error node for this failed entry
                let error_path = e.path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                let error_name = e.path()
                    .and_then(|p| p.file_name())
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                entries.push(FileNode {
                    name: error_name,
                    path: error_path,
                    file_type: "error".to_string(),
                    children: None,
                    error: Some(format!("Failed to read entry: {}", e)),
                });
                continue;
            }
        };

        if entry.path() == Path::new(path) {
            continue;
        }

        // Try to get metadata, handle errors gracefully
        let metadata_result = entry.metadata();

        match metadata_result {
            Ok(metadata) => {
                let is_dir = metadata.is_dir();

                let mut node = FileNode {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: entry.path().to_string_lossy().to_string(),
                    file_type: if is_dir { "directory".to_string() } else { "file".to_string() },
                    children: None,
                    error: None,
                };

                if is_dir {
                    // Recursively build children, but handle errors gracefully
                    match build_tree_recursive(&node.path, max_depth - 1) {
                        Ok(children) => {
                            node.children = Some(children);
                        }
                        Err(e) => {
                            // Directory exists but we can't read its contents
                            node.children = Some(vec![]);
                            node.error = Some(format!("Failed to read directory contents: {}", e));
                        }
                    }
                }

                entries.push(node);
            }
            Err(e) => {
                // Can't read metadata - create an error node
                entries.push(FileNode {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: entry.path().to_string_lossy().to_string(),
                    file_type: "error".to_string(),
                    children: None,
                    error: Some(format!("Permission denied or access error: {}", e)),
                });
            }
        }
    }

    Ok(entries)
}

#[tauri::command]
pub async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

    if metadata.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub extension: String,
    pub is_image: bool,
    pub modified: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaDirectory {
    pub name: String,
    pub path: String,
    pub files: Vec<MediaFile>,
    pub subdirectories: Vec<String>,
}

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];

/// List media files in the project's static directory
#[tauri::command]
pub async fn list_media_files(project_path: String, subdirectory: Option<String>) -> Result<MediaDirectory, String> {
    let static_dir = PathBuf::from(&project_path).join("static");
    let target_dir = if let Some(sub) = subdirectory {
        static_dir.join(sub)
    } else {
        static_dir.clone()
    };

    if !target_dir.exists() {
        // Return empty directory if it doesn't exist
        return Ok(MediaDirectory {
            name: target_dir.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("static")
                .to_string(),
            path: target_dir.to_string_lossy().to_string(),
            files: vec![],
            subdirectories: vec![],
        });
    }

    let mut files = Vec::new();
    let mut subdirectories = Vec::new();

    for entry in fs::read_dir(&target_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| e.to_string())?;

        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                subdirectories.push(name.to_string());
            }
        } else {
            let name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            let extension = path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            let is_image = IMAGE_EXTENSIONS.contains(&extension.as_str());

            files.push(MediaFile {
                name: name.clone(),
                path: path.to_string_lossy().to_string(),
                size: metadata.len(),
                extension,
                is_image,
                modified: metadata.modified()
                    .map_err(|e| e.to_string())?
                    .duration_since(std::time::UNIX_EPOCH)
                    .map_err(|e| e.to_string())?
                    .as_secs(),
            });
        }
    }

    // Sort files by modification time (newest first)
    files.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(MediaDirectory {
        name: target_dir.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("static")
            .to_string(),
        path: target_dir.to_string_lossy().to_string(),
        files,
        subdirectories,
    })
}

/// Delete a media file
#[tauri::command]
pub async fn delete_media_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    if !path.is_file() {
        return Err("Path is not a file".to_string());
    }

    fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;

    Ok(())
}

/// Delete a media directory and all its contents
#[tauri::command]
pub async fn delete_media_directory(dir_path: String) -> Result<(), String> {
    let path = PathBuf::from(&dir_path);

    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    fs::remove_dir_all(&path).map_err(|e| format!("Failed to delete directory: {}", e))?;

    Ok(())
}

/// Rename a media file or directory
#[tauri::command]
pub async fn rename_media_item(old_path: String, new_name: String) -> Result<String, String> {
    let old_path = PathBuf::from(&old_path);

    if !old_path.exists() {
        return Err("Item does not exist".to_string());
    }

    let parent = old_path.parent()
        .ok_or("Invalid path")?;

    let new_path = parent.join(&new_name);

    if new_path.exists() {
        return Err("An item with that name already exists".to_string());
    }

    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

/// Create a subdirectory in static
#[tauri::command]
pub async fn create_media_directory(project_path: String, directory_name: String) -> Result<String, String> {
    let static_dir = PathBuf::from(&project_path).join("static");
    let new_dir = static_dir.join(&directory_name);

    if new_dir.exists() {
        return Err("Directory already exists".to_string());
    }

    fs::create_dir_all(&new_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    Ok(new_dir.to_string_lossy().to_string())
}

/// Get image dimensions (for thumbnails)
#[tauri::command]
pub async fn get_image_info(file_path: String) -> Result<ImageInfo, String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let extension = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Try to get image dimensions for common formats
    let (width, height) = if IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        get_image_dimensions(&path).unwrap_or((0, 0))
    } else {
        (0, 0)
    };

    Ok(ImageInfo {
        path: file_path,
        size: metadata.len(),
        width,
        height,
        extension,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageInfo {
    pub path: String,
    pub size: u64,
    pub width: u32,
    pub height: u32,
    pub extension: String,
}

fn get_image_dimensions(path: &PathBuf) -> Option<(u32, u32)> {
    let extension = path.extension()
        .and_then(|e| e.to_str())?
        .to_lowercase();

    match extension.as_str() {
        "png" => get_png_dimensions(path),
        "jpg" | "jpeg" => get_jpeg_dimensions(path),
        "gif" => get_gif_dimensions(path),
        _ => None,
    }
}

fn get_png_dimensions(path: &PathBuf) -> Option<(u32, u32)> {
    let data = fs::read(path).ok()?;
    if data.len() < 24 {
        return None;
    }

    // Check PNG signature
    if &data[0..8] != &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
        return None;
    }

    // Width and height are at bytes 16-23 (big-endian)
    let width = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
    let height = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);

    Some((width, height))
}

fn get_jpeg_dimensions(path: &PathBuf) -> Option<(u32, u32)> {
    let data = fs::read(path).ok()?;

    let mut i = 0;
    while i < data.len() - 1 {
        if data[i] == 0xFF {
            let marker = data[i + 1];

            // Skip padding
            if marker == 0xFF {
                i += 1;
                continue;
            }

            // SOF markers (Start of Frame)
            if (0xC0..=0xCF).contains(&marker) && marker != 0xC4 && marker != 0xC8 && marker != 0xCC {
                if i + 9 < data.len() {
                    let height = u16::from_be_bytes([data[i + 5], data[i + 6]]) as u32;
                    let width = u16::from_be_bytes([data[i + 7], data[i + 8]]) as u32;
                    return Some((width, height));
                }
            }

            // Skip this segment
            if marker != 0x00 && marker != 0x01 && (marker < 0xD0 || marker > 0xD9) {
                if i + 3 < data.len() {
                    let len = u16::from_be_bytes([data[i + 2], data[i + 3]]) as usize;
                    i += len + 2;
                    continue;
                }
            }
        }
        i += 1;
    }

    None
}

fn get_gif_dimensions(path: &PathBuf) -> Option<(u32, u32)> {
    let data = fs::read(path).ok()?;
    if data.len() < 10 {
        return None;
    }

    // Check GIF signature
    if &data[0..3] != b"GIF" {
        return None;
    }

    // Width and height are at bytes 6-9 (little-endian)
    let width = u16::from_le_bytes([data[6], data[7]]) as u32;
    let height = u16::from_le_bytes([data[8], data[9]]) as u32;

    Some((width, height))
}

/// Upload media files to the project
#[tauri::command]
pub async fn upload_media_files(
    project_path: String,
    subdirectory: Option<String>,
    files: Vec<UploadFile>,
) -> Result<Vec<String>, String> {
    use std::io::Write;

    let static_dir = PathBuf::from(&project_path).join("static");
    let target_dir = if let Some(sub) = subdirectory {
        static_dir.join(sub)
    } else {
        static_dir.clone()
    };

    // Create target directory if it doesn't exist
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let mut uploaded_paths = Vec::new();

    for file in files {
        let file_path = target_dir.join(&file.name);

        // Check if file already exists
        if file_path.exists() {
            return Err(format!("File '{}' already exists", file.name));
        }

        // Decode base64 content and write file
        let decoded = base64_decode(&file.content)
            .map_err(|e| format!("Failed to decode file content: {}", e))?;

        let mut output = fs::File::create(&file_path)
            .map_err(|e| format!("Failed to create file: {}", e))?;

        output.write_all(&decoded)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        uploaded_paths.push(file_path.to_string_lossy().to_string());
    }

    Ok(uploaded_paths)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UploadFile {
    pub name: String,
    pub content: String, // base64 encoded
}

/// Read an image file and return it as a base64 data URL
#[tauri::command]
pub async fn read_image_base64(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    if !path.is_file() {
        return Err("Path is not a file".to_string());
    }

    // Read file content
    let content = fs::read(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Detect MIME type based on file extension
    let extension = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mime_type = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    };

    // Encode to base64
    let base64_content = base64_encode(&content);

    // Return as data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_content))
}

// Simple base64 encoder/decoder
fn base64_encode(input: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(input)
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(input)
        .map_err(|e| e.to_string())
}

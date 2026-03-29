use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    pub modified: Vec<String>,
    pub staged: Vec<String>,
    pub untracked: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[tauri::command]
pub async fn git_status(project_path: String) -> Result<GitStatus, String> {
    // Get current branch
    let branch_output = Command::new("git")
        .current_dir(&project_path)
        .args(["branch", "--show-current"])
        .output()
        .map_err(|e| format!("Failed to get branch: {}", e))?;

    let branch = String::from_utf8_lossy(&branch_output.stdout).trim().to_string();

    // Get status
    let status_output = Command::new("git")
        .current_dir(&project_path)
        .args(["status", "--porcelain", "--branch"])
        .output()
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let status_text = String::from_utf8_lossy(&status_output.stdout);
    let lines: Vec<&str> = status_text.lines().collect();

    let mut modified = Vec::new();
    let mut staged = Vec::new();
    let mut untracked = Vec::new();
    let mut ahead = 0;
    let mut behind = 0;

    for line in lines {
        if line.starts_with("##") {
            // Parse branch info
            if let Some(pos) = line.find("[") {
                let info = &line[pos..];
                if info.contains("ahead") {
                    let parts: Vec<&str> = info.split_whitespace().collect();
                    for (i, part) in parts.iter().enumerate() {
                        if *part == "ahead" && i + 1 < parts.len() {
                            ahead = parts[i + 1]
                                .trim_end_matches(",")
                                .trim_end_matches("]")
                                .parse()
                                .unwrap_or(0);
                        }
                        if *part == "behind" && i + 1 < parts.len() {
                            behind = parts[i + 1]
                                .trim_end_matches("]")
                                .parse()
                                .unwrap_or(0);
                        }
                    }
                }
            }
        } else if line.len() >= 2 {
            let status = &line[..2];
            let file = line[3..].to_string();

            if status.starts_with("?") {
                untracked.push(file);
            } else if status.starts_with(" ") || status.starts_with("M") {
                if status.starts_with("M") {
                    staged.push(file.clone());
                }
                modified.push(file);
            } else {
                staged.push(file);
            }
        }
    }

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        modified,
        staged,
        untracked,
    })
}

#[tauri::command]
pub async fn git_add(project_path: String, files: Vec<String>) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .arg("add")
        .args(&files)
        .output()
        .map_err(|e| format!("Failed to add files: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_reset(project_path: String, files: Vec<String>) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .arg("reset")
        .args(&files)
        .output()
        .map_err(|e| format!("Failed to reset files: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_commit(project_path: String, message: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["commit", "-m", &message])
        .output()
        .map_err(|e| format!("Failed to commit: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_push(project_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["push"])
        .output()
        .map_err(|e| format!("Failed to push: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_pull(project_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["pull"])
        .output()
        .map_err(|e| format!("Failed to pull: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_diff(
    project_path: String,
    file: Option<String>,
    staged: bool,
) -> Result<String, String> {
    let mut args: Vec<String> = vec!["diff".to_string()];
    if staged {
        args.push("--staged".to_string());
    }
    args.push("--no-color".to_string());
    if let Some(f) = file {
        args.push(f);
    }

    let output = Command::new("git")
        .current_dir(&project_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to get diff: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_log(project_path: String, count: Option<i32>) -> Result<Vec<GitCommit>, String> {
    let count = count.unwrap_or(50);
    let output = Command::new("git")
        .current_dir(&project_path)
        .args([
            "log",
            &format!("-{}", count),
            "--pretty=format:%H|%h|%s|%an|%ad",
            "--date=short",
        ])
        .output()
        .map_err(|e| format!("Failed to get log: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let log_text = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();

    for line in log_text.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 5 {
            commits.push(GitCommit {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                message: parts[2].to_string(),
                author: parts[3].to_string(),
                date: parts[4].to_string(),
            });
        }
    }

    Ok(commits)
}

#[tauri::command]
pub async fn git_branch_list(project_path: String) -> Result<Vec<GitBranch>, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["branch", "-a", "--format=%(refname:short)|%(HEAD)"])
        .output()
        .map_err(|e| format!("Failed to list branches: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let branch_text = String::from_utf8_lossy(&output.stdout);
    let mut branches = Vec::new();

    for line in branch_text.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 2 {
            let name = parts[0].to_string();
            let is_current = parts[1] == "*";
            let is_remote = name.starts_with("remotes/");

            branches.push(GitBranch {
                name: if is_remote {
                    name.strip_prefix("remotes/").unwrap_or(&name).to_string()
                } else {
                    name
                },
                is_current,
                is_remote,
            });
        }
    }

    Ok(branches)
}

#[tauri::command]
pub async fn git_checkout(project_path: String, branch: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["checkout", &branch])
        .output()
        .map_err(|e| format!("Failed to checkout: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_create_branch(
    project_path: String,
    branch: String,
    checkout: bool,
) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["branch", &branch])
        .output()
        .map_err(|e| format!("Failed to create branch: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    if checkout {
        let checkout_output = Command::new("git")
            .current_dir(&project_path)
            .args(["checkout", &branch])
            .output()
            .map_err(|e| format!("Failed to checkout new branch: {}", e))?;

        if !checkout_output.status.success() {
            return Err(String::from_utf8_lossy(&checkout_output.stderr).to_string());
        }
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ==================== Stash Commands ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitStash {
    pub index: usize,
    pub message: String,
    pub branch: String,
    pub hash: String,
}

#[tauri::command]
pub async fn git_stash_list(project_path: String) -> Result<Vec<GitStash>, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["stash", "list", "--format=%gd|%s|%H"])
        .output()
        .map_err(|e| format!("Failed to list stashes: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut stashes = Vec::new();

    for (index, line) in stdout.lines().enumerate() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 3 {
            stashes.push(GitStash {
                index,
                message: parts[1].to_string(),
                hash: parts[2].to_string(),
                branch: parts[0].to_string(),
            });
        }
    }

    Ok(stashes)
}

#[tauri::command]
pub async fn git_stash_save(project_path: String, message: Option<String>) -> Result<String, String> {
    let mut args: Vec<String> = vec!["stash".to_string(), "push".to_string()];

    if let Some(msg) = message {
        args.push("-m".to_string());
        args.push(msg);
    }

    let output = Command::new("git")
        .current_dir(&project_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to stash: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_stash_pop(project_path: String, stash_index: Option<usize>) -> Result<String, String> {
    let stash_ref = stash_index
        .map(|i| format!("stash@{{{}}}", i))
        .unwrap_or_else(|| "stash@{0}".to_string());

    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["stash", "pop", &stash_ref])
        .output()
        .map_err(|e| format!("Failed to pop stash: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_stash_drop(project_path: String, stash_index: usize) -> Result<String, String> {
    let stash_ref = format!("stash@{{{}}}", stash_index);

    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["stash", "drop", &stash_ref])
        .output()
        .map_err(|e| format!("Failed to drop stash: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_stash_apply(project_path: String, stash_index: Option<usize>) -> Result<String, String> {
    let stash_ref = stash_index
        .map(|i| format!("stash@{{{}}}", i))
        .unwrap_or_else(|| "stash@{0}".to_string());

    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["stash", "apply", &stash_ref])
        .output()
        .map_err(|e| format!("Failed to apply stash: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ==================== Tag Commands ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitTag {
    pub name: String,
    pub hash: String,
    pub message: Option<String>,
    pub date: String,
    pub tagger: Option<String>,
}

#[tauri::command]
pub async fn git_tag_list(project_path: String) -> Result<Vec<GitTag>, String> {
    // Get all tags with their info
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["tag", "-l", "-n1"])
        .output()
        .map_err(|e| format!("Failed to list tags: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut tags = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(2, ' ').collect();
        if let Some(name) = parts.first() {
            let message = parts.get(1).map(|s| s.trim().to_string());

            // Get tag hash
            let hash_output = Command::new("git")
                .current_dir(&project_path)
                .args(["rev-list", "-n1", name])
                .output();

            let hash = match hash_output {
                Ok(h) if h.status.success() => String::from_utf8_lossy(&h.stdout).trim().to_string(),
                _ => String::new(),
            };

            tags.push(GitTag {
                name: name.to_string(),
                hash,
                message,
                date: String::new(),
                tagger: None,
            });
        }
    }

    Ok(tags)
}

#[tauri::command]
pub async fn git_tag_create(
    project_path: String,
    name: String,
    message: Option<String>,
    commit: Option<String>,
) -> Result<String, String> {
    let mut args: Vec<String> = vec!["tag".to_string()];

    if let Some(msg) = &message {
        args.push("-a".to_string());
        args.push("-m".to_string());
        args.push(msg.clone());
    }

    args.push(name.clone());

    if let Some(c) = commit {
        args.push(c);
    }

    let output = Command::new("git")
        .current_dir(&project_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to create tag: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Tag '{}' created successfully", name))
}

#[tauri::command]
pub async fn git_tag_delete(project_path: String, name: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["tag", "-d", &name])
        .output()
        .map_err(|e| format!("Failed to delete tag: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Tag '{}' deleted successfully", name))
}

#[tauri::command]
pub async fn git_tag_push(project_path: String, name: Option<String>) -> Result<String, String> {
    let mut args: Vec<String> = vec!["push".to_string(), "origin".to_string()];

    if let Some(n) = name {
        args.push(n);
    } else {
        args.push("--tags".to_string());
    }

    let output = Command::new("git")
        .current_dir(&project_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to push tag: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ==================== Remote Commands ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitRemote {
    pub name: String,
    pub url: String,
}

#[tauri::command]
pub async fn git_remote_list(project_path: String) -> Result<Vec<GitRemote>, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["remote", "-v"])
        .output()
        .map_err(|e| format!("Failed to list remotes: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut remotes = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let name = parts[0].to_string();
            let url = parts[1].to_string();

            // Only add fetch remotes, avoid duplicates
            if !seen.contains(&name) {
                seen.insert(name.clone());
                remotes.push(GitRemote { name, url });
            }
        }
    }

    Ok(remotes)
}

#[tauri::command]
pub async fn git_remote_add(project_path: String, name: String, url: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["remote", "add", &name, &url])
        .output()
        .map_err(|e| format!("Failed to add remote: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Remote '{}' added successfully", name))
}

#[tauri::command]
pub async fn git_remote_remove(project_path: String, name: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["remote", "remove", &name])
        .output()
        .map_err(|e| format!("Failed to remove remote: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Remote '{}' removed successfully", name))
}

// ==================== Init & Config Commands ====================

#[tauri::command]
pub async fn git_init(project_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["init"])
        .output()
        .map_err(|e| format!("Failed to init git: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn git_config_get(project_path: String, key: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["config", "--local", &key])
        .output()
        .map_err(|e| format!("Failed to get config: {}", e))?;

    // Config may not exist, that's ok
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub async fn git_config_set(project_path: String, key: String, value: String) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["config", "--local", &key, &value])
        .output()
        .map_err(|e| format!("Failed to set config: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Config '{}' set to '{}'", key, value))
}

#[tauri::command]
pub async fn git_is_repository(project_path: String) -> Result<bool, String> {
    let output = Command::new("git")
        .current_dir(&project_path)
        .args(["rev-parse", "--git-dir"])
        .output()
        .map_err(|e| format!("Failed to check git: {}", e))?;

    Ok(output.status.success())
}


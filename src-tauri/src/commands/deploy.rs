use std::process::Command;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter};

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DeployConfig {
    pub repo_url: String,
    pub user_name: String,
    pub user_email: String,
    #[serde(default)]
    pub path_prefix: String, // Path prefix for static assets (e.g., "/blog")
    #[serde(default = "default_branch")]
    pub target_branch: String, // Target branch for deployment, default: "main"
}

fn default_branch() -> String {
    "main".to_string()
}

#[derive(Debug, serde::Serialize, Clone)]
struct DeployProgressEvent {
    pub step: String,
    pub command: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub status: String, // "running", "success", "error"
    pub stdout: String,
    pub stderr: String,
}

fn emit_deploy_progress(app: &AppHandle, event: DeployProgressEvent) {
    app.emit("deploy-progress", event).ok();
}

/// Derive the path prefix from repository URL for static assets
/// Returns the path prefix like "/blog" or empty string for user pages
fn derive_path_prefix(repo_url: &str) -> String {
    // Remove .git suffix if present
    let url = repo_url.trim_end_matches(".git");

    // Extract repo name
    let repo_name = if url.starts_with("https://github.com/") {
        let parts: Vec<&str> = url["https://github.com/".len()..].split('/').collect();
        if parts.len() >= 2 {
            parts[1]
        } else {
            return String::new();
        }
    } else if url.starts_with("git@github.com:") {
        let parts: Vec<&str> = url["git@github.com:".len()..].split('/').collect();
        if parts.len() >= 2 {
            parts[1]
        } else {
            return String::new();
        }
    } else {
        return String::new();
    };

    // Extract username
    let username = if url.starts_with("https://github.com/") {
        url["https://github.com/".len()..].split('/').next().unwrap_or("")
    } else if url.starts_with("git@github.com:") {
        url["git@github.com:".len()..].split('/').next().unwrap_or("")
    } else {
        ""
    };

    // Check if it's a user/org page
    let expected_user_page = format!("{}.{}", username, "github.io");
    if repo_name == expected_user_page {
        // User/Organization page: no path prefix
        String::new()
    } else {
        // Project page: use repo name as path prefix
        format!("/{}", repo_name)
    }
}

/// Deploy Hugo site to GitHub Pages (configured branch)
#[tauri::command]
pub async fn deploy_to_pages(
    app: AppHandle,
    project_path: String,
    repo_url: String,
    user_name: String,
    user_email: String,
    target_branch: Option<String>,
) -> Result<String, String> {
    let public_path = format!("{}/public", project_path);

    // Step 1: Build Hugo site
    // Note: baseURL is now read from hugo.toml config file
    println!("Building Hugo site...");

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "hugo_build".to_string(),
        command: "hugo".to_string(),
        args: vec!["--gc".to_string(), "--minify".to_string()],
        cwd: project_path.clone(),
        status: "running".to_string(),
        stdout: "".to_string(),
        stderr: "".to_string(),
    });

    let build_output = Command::new("hugo")
        .current_dir(&project_path)
        .args(&["--gc", "--minify"])
        .output()
        .map_err(|e| format!("Failed to build Hugo site: {}. Make sure Hugo is installed.", e))?;

    if !build_output.status.success() {
        let stderr = String::from_utf8_lossy(&build_output.stderr);
        emit_deploy_progress(&app, DeployProgressEvent {
            step: "hugo_build".to_string(),
            command: "hugo".to_string(),
            args: vec![],
            cwd: project_path.clone(),
            status: "error".to_string(),
            stdout: "".to_string(),
            stderr: stderr.to_string(),
        });
        return Err(format!("Hugo build failed: {}", stderr));
    }

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "hugo_build".to_string(),
        command: "hugo".to_string(),
        args: vec![],
        cwd: project_path.clone(),
        status: "success".to_string(),
        stdout: String::from_utf8_lossy(&build_output.stdout).to_string(),
        stderr: "".to_string(),
    });

    // Verify public directory exists and is not empty
    if !Path::new(&public_path).exists() {
        return Err("Hugo build completed but public/ directory not found".to_string());
    }

    let public_entries = fs::read_dir(&public_path)
        .map_err(|e| format!("Failed to read public directory: {}", e))?;

    if public_entries.count() == 0 {
        return Err("Hugo build completed but public/ directory is empty".to_string());
    }

    // Step 2: Initialize git in public directory
    println!("Initializing git in public directory...");

    // Remove existing .git if exists
    let git_dir = format!("{}/.git", public_path);
    if Path::new(&git_dir).exists() {
        fs::remove_dir_all(&git_dir)
            .map_err(|e| format!("Failed to remove existing .git: {}", e))?;
    }

    // Initialize new repo
    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_init".to_string(),
        command: "git".to_string(),
        args: vec!["init".to_string()],
        cwd: public_path.clone(),
        status: "running".to_string(),
        stdout: "".to_string(),
        stderr: "".to_string(),
    });

    let init_output = Command::new("git")
        .current_dir(&public_path)
        .args(["init"])
        .output()
        .map_err(|e| format!("Failed to init git: {}", e))?;

    if !init_output.status.success() {
        let stderr = String::from_utf8_lossy(&init_output.stderr);
        emit_deploy_progress(&app, DeployProgressEvent {
            step: "git_init".to_string(),
            command: "git".to_string(),
            args: vec!["init".to_string()],
            cwd: public_path.clone(),
            status: "error".to_string(),
            stdout: "".to_string(),
            stderr: stderr.to_string(),
        });
        return Err(format!("Git init failed: {}", stderr));
    }

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_init".to_string(),
        command: "git".to_string(),
        args: vec!["init".to_string()],
        cwd: public_path.clone(),
        status: "success".to_string(),
        stdout: String::from_utf8_lossy(&init_output.stdout).to_string(),
        stderr: "".to_string(),
    });

    // Step 3: Configure git user
    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_config".to_string(),
        command: "git".to_string(),
        args: vec!["config".to_string(), "user.name".to_string(), user_name.clone()],
        cwd: public_path.clone(),
        status: "running".to_string(),
        stdout: "".to_string(),
        stderr: "".to_string(),
    });

    Command::new("git")
        .current_dir(&public_path)
        .args(["config", "user.name", &user_name])
        .output()
        .map_err(|e| format!("Failed to set user.name: {}", e))?;

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_config".to_string(),
        command: "git".to_string(),
        args: vec!["config".to_string(), "user.email".to_string(), user_email.clone()],
        cwd: public_path.clone(),
        status: "running".to_string(),
        stdout: "".to_string(),
        stderr: "".to_string(),
    });

    Command::new("git")
        .current_dir(&public_path)
        .args(["config", "user.email", &user_email])
        .output()
        .map_err(|e| format!("Failed to set user.email: {}", e))?;

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_config".to_string(),
        command: "git".to_string(),
        args: vec!["config".to_string()],
        cwd: public_path.clone(),
        status: "success".to_string(),
        stdout: format!("Set user.name={} and user.email={}", user_name, user_email),
        stderr: "".to_string(),
    });

    // Step 4: Add remote
    println!("Adding remote...");
    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_remote".to_string(),
        command: "git".to_string(),
        args: vec!["remote".to_string(), "add".to_string(), "origin".to_string(), repo_url.clone()],
        cwd: public_path.clone(),
        status: "running".to_string(),
        stdout: "".to_string(),
        stderr: "".to_string(),
    });

    let remote_output = Command::new("git")
        .current_dir(&public_path)
        .args(["remote", "add", "origin", &repo_url])
        .output()
        .map_err(|e| format!("Failed to add remote: {}", e))?;

    if !remote_output.status.success() {
        // Try to set-url if remote already exists
        Command::new("git")
            .current_dir(&public_path)
            .args(["remote", "set-url", "origin", &repo_url])
            .output()
            .map_err(|e| format!("Failed to set remote url: {}", e))?;
    }

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_remote".to_string(),
        command: "git".to_string(),
        args: vec!["remote".to_string()],
        cwd: public_path.clone(),
        status: "success".to_string(),
        stdout: format!("Added remote origin: {}", repo_url),
        stderr: "".to_string(),
    });

    // Step 5: Add all files
    println!("Adding files...");

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_add".to_string(),
        command: "git".to_string(),
        args: vec!["add".to_string(), ".".to_string()],
        cwd: public_path.clone(),
        status: "running".to_string(),
        stdout: "".to_string(),
        stderr: "".to_string(),
    });

    let add_output = Command::new("git")
        .current_dir(&public_path)
        .args(["add", "."])
        .output()
        .map_err(|e| format!("Failed to add files: {}", e))?;

    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr);
        emit_deploy_progress(&app, DeployProgressEvent {
            step: "git_add".to_string(),
            command: "git".to_string(),
            args: vec!["add".to_string(), ".".to_string()],
            cwd: public_path.clone(),
            status: "error".to_string(),
            stdout: "".to_string(),
            stderr: stderr.to_string(),
        });
        return Err(format!("Git add failed: {}", stderr));
    }

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_add".to_string(),
        command: "git".to_string(),
        args: vec!["add".to_string(), ".".to_string()],
        cwd: public_path.clone(),
        status: "success".to_string(),
        stdout: String::from_utf8_lossy(&add_output.stdout).to_string(),
        stderr: "".to_string(),
    });

    // Step 6: Commit
    println!("Committing...");
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
    let commit_message = format!("Deploy: {}", timestamp);

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_commit".to_string(),
        command: "git".to_string(),
        args: vec!["commit".to_string(), "-m".to_string(), commit_message.clone()],
        cwd: public_path.clone(),
        status: "running".to_string(),
        stdout: "".to_string(),
        stderr: "".to_string(),
    });

    let commit_output = Command::new("git")
        .current_dir(&public_path)
        .args(["commit", "-m", &commit_message])
        .output()
        .map_err(|e| format!("Failed to commit: {}", e))?;

    if !commit_output.status.success() {
        // Check if nothing to commit
        let stderr = String::from_utf8_lossy(&commit_output.stderr);
        if stderr.contains("nothing to commit") {
            println!("Nothing to commit, continuing...");
            emit_deploy_progress(&app, DeployProgressEvent {
                step: "git_commit".to_string(),
                command: "git".to_string(),
                args: vec!["commit".to_string()],
                cwd: public_path.clone(),
                status: "success".to_string(),
                stdout: "Nothing to commit".to_string(),
                stderr: "".to_string(),
            });
        } else {
            emit_deploy_progress(&app, DeployProgressEvent {
                step: "git_commit".to_string(),
                command: "git".to_string(),
                args: vec!["commit".to_string()],
                cwd: public_path.clone(),
                status: "error".to_string(),
                stdout: "".to_string(),
                stderr: stderr.to_string(),
            });
            return Err(format!("Git commit failed: {}", stderr));
        }
    } else {
        emit_deploy_progress(&app, DeployProgressEvent {
            step: "git_commit".to_string(),
            command: "git".to_string(),
            args: vec!["commit".to_string(), "-m".to_string(), commit_message],
            cwd: public_path.clone(),
            status: "success".to_string(),
            stdout: String::from_utf8_lossy(&commit_output.stdout).to_string(),
            stderr: "".to_string(),
        });
    }

    // Use configured branch or default to "main"
    let target_branch = target_branch.unwrap_or_else(|| "main".to_string());

    // Step 6.5: Create and checkout configured branch
    println!("Creating {} branch...", target_branch);
    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_branch".to_string(),
        command: "git".to_string(),
        args: vec!["checkout".to_string(), "-b".to_string(), target_branch.clone()],
        cwd: public_path.clone(),
        status: "running".to_string(),
        stdout: "".to_string(),
        stderr: "".to_string(),
    });

    let branch_output = Command::new("git")
        .current_dir(&public_path)
        .args(["checkout", "-b", &target_branch])
        .output()
        .map_err(|e| format!("Failed to create {} branch: {}", target_branch, e))?;

    if !branch_output.status.success() {
        // If branch already exists, just checkout
        Command::new("git")
            .current_dir(&public_path)
            .args(["checkout", &target_branch])
            .output()
            .map_err(|e| format!("Failed to checkout {} branch: {}", target_branch, e))?;
    }

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_branch".to_string(),
        command: "git".to_string(),
        args: vec!["checkout".to_string(), "-b".to_string(), target_branch.clone()],
        cwd: public_path.clone(),
        status: "success".to_string(),
        stdout: format!("Switched to branch '{}'", target_branch),
        stderr: "".to_string(),
    });

    // Step 7: Push to configured branch (force)
    println!("Pushing to {} branch...", target_branch);
    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_push".to_string(),
        command: "git".to_string(),
        args: vec!["push".to_string(), "origin".to_string(), target_branch.clone(), "--force".to_string()],
        cwd: public_path.clone(),
        status: "running".to_string(),
        stdout: "".to_string(),
        stderr: "".to_string(),
    });

    let push_output = Command::new("git")
        .current_dir(&public_path)
        .args(["push", "origin", &target_branch, "--force"])
        .output()
        .map_err(|e| format!("Failed to push: {}", e))?;

    if !push_output.status.success() {
        let stderr = String::from_utf8_lossy(&push_output.stderr);
        emit_deploy_progress(&app, DeployProgressEvent {
            step: "git_push".to_string(),
            command: "git".to_string(),
            args: vec!["push".to_string()],
            cwd: public_path.clone(),
            status: "error".to_string(),
            stdout: "".to_string(),
            stderr: stderr.to_string(),
        });
        return Err(format!(
            "Git push failed. Make sure you have write access to the repository and the branch '{}' exists. Error: {}",
            target_branch, stderr
        ));
    }

    emit_deploy_progress(&app, DeployProgressEvent {
        step: "git_push".to_string(),
        command: "git".to_string(),
        args: vec!["push".to_string(), "origin".to_string(), target_branch.clone(), "--force".to_string()],
        cwd: public_path.clone(),
        status: "success".to_string(),
        stdout: String::from_utf8_lossy(&push_output.stdout).to_string(),
        stderr: "".to_string(),
    });

    // Cleanup: remove .git from public
    fs::remove_dir_all(&git_dir).ok();

    Ok(format!("Successfully deployed to {} ({} branch)", repo_url, target_branch))
}

/// Save deploy config to project directory
#[tauri::command]
pub async fn save_deploy_config(
    project_path: String,
    config: DeployConfig,
) -> Result<(), String> {
    let config_path = format!("{}/.hugo-cms-deploy.json", project_path);
    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}

/// Load deploy config from project directory
#[tauri::command]
pub async fn load_deploy_config(
    project_path: String,
) -> Result<Option<DeployConfig>, String> {
    let config_path = format!("{}/.hugo-cms-deploy.json", project_path);

    if !Path::new(&config_path).exists() {
        return Ok(None);
    }

    let config_json = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let mut config: DeployConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;

    // Backward compatibility: if path_prefix is empty, derive it from repo_url
    if config.path_prefix.is_empty() && !config.repo_url.is_empty() {
        config.path_prefix = derive_path_prefix(&config.repo_url);
    }

    Ok(Some(config))
}

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use std::sync::Mutex;
use commands::{deploy, file, git, hugo, media, project, settings, theme};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(hugo::HugoProcess::default())
        .manage(Mutex::new(settings::AppSettings::default()))
        .invoke_handler(tauri::generate_handler![
            // Project commands
            project::open_project,
            project::detect_hugo_version,
            // Hugo commands
            hugo::hugo_server,
            hugo::stop_hugo_server,
            hugo::hugo_build,
            hugo::hugo_new_content,
            hugo::execute_command,
            hugo::open_preview_window,
            hugo::close_preview_window,
            // File commands
            file::read_file,
            file::write_file,
            file::list_directory,
            file::build_file_tree,
            file::create_directory,
            file::delete_file,
            file::rename_file,
            file::open_url,
            // Git commands
            git::git_status,
            git::git_add,
            git::git_reset,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_diff,
            git::git_log,
            git::git_branch_list,
            git::git_checkout,
            git::git_create_branch,
            // Git stash commands
            git::git_stash_list,
            git::git_stash_save,
            git::git_stash_pop,
            git::git_stash_drop,
            git::git_stash_apply,
            // Git tag commands
            git::git_tag_list,
            git::git_tag_create,
            git::git_tag_delete,
            git::git_tag_push,
            // Git remote commands
            git::git_remote_list,
            git::git_remote_add,
            git::git_remote_remove,
            // Git init & config commands
            git::git_init,
            git::git_config_get,
            git::git_config_set,
            git::git_is_repository,
            // Settings commands
            settings::verify_hugo_path,
            settings::detect_hugo_path,
            settings::is_hugo_available,
            // Theme commands
            theme::list_themes,
            theme::get_current_theme,
            theme::set_theme,
            theme::install_theme_git,
            theme::install_theme_zip,
            theme::install_theme_folder,
            theme::download_and_install_theme,
            theme::uninstall_theme,
            theme::get_official_themes,
            theme::check_theme_updates,
            theme::update_theme,
            // Deploy commands
            deploy::deploy_to_pages,
            deploy::save_deploy_config,
            deploy::load_deploy_config,
            // Media commands
            media::list_media_files,
            media::delete_media_file,
            media::delete_media_directory,
            media::rename_media_item,
            media::create_media_directory,
            media::get_image_info,
            media::upload_media_files,
            media::read_image_base64,
        ])
        .setup(|_app| {
            // Setup code here if needed
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

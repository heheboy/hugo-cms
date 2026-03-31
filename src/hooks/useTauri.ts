import { invoke } from '@tauri-apps/api/core';
import { listen, type Event } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type { HugoProject, FileNode, CommandOutput } from '@/types';
import { useCommandHistoryStore } from '@/stores/commandHistoryStore';

// Deploy progress event from Rust
interface DeployProgressEvent {
  step: string;
  command: string;
  args: string[];
  cwd: string;
  status: 'running' | 'success' | 'error';
  stdout: string;
  stderr: string;
}

// Wrapped command execution with history logging
export async function executeCommandWithHistory(
  projectPath: string,
  command: string,
  args: string[]
): Promise<CommandOutput> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  // Add command to history
  const commandId = addCommand({
    command,
    args,
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    const result = await invoke<CommandOutput>('execute_command', { projectPath, command, args });

    // Update command with result
    updateCommand(commandId, {
      status: result.exit_code === 0 ? 'success' : 'error',
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exit_code ?? 0,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    // Update command with error
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

// Project API
export async function openProjectDialog(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Hugo Project Directory',
  });
  return selected as string | null;
}

export async function createSiteDialog(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Directory for New Site',
  });
  return selected as string | null;
}

export async function openProject(path: string): Promise<HugoProject> {
  return invoke('open_project', { path });
}

export async function detectHugoVersion(): Promise<string> {
  return invoke('detect_hugo_version');
}

// File API
export async function readFile(path: string): Promise<string> {
  return invoke('read_file', { path });
}

export async function writeFile(path: string, content: string): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'write',
    args: [path, `(${content.length} bytes)`],
    cwd: '',
    stdout: '',
    stderr: '',
  });

  try {
    await invoke('write_file', { path, content });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Written: ${path} (${content.length} bytes)`,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function listDirectory(path: string): Promise<FileNode[]> {
  return invoke('list_directory', { path });
}

export async function buildFileTree(path: string): Promise<FileNode[]> {
  return invoke('build_file_tree', { path });
}

export async function createDirectory(path: string): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'mkdir',
    args: ['-p', path],
    cwd: '',
    stdout: '',
    stderr: '',
  });

  try {
    await invoke('create_directory', { path });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Created directory: ${path}`,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function deleteFile(path: string): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'rm',
    args: [path],
    cwd: '',
    stdout: '',
    stderr: '',
  });

  try {
    await invoke('delete_file', { path });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Deleted: ${path}`,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'mv',
    args: [oldPath, newPath],
    cwd: '',
    stdout: '',
    stderr: '',
  });

  try {
    await invoke('rename_file', { oldPath, newPath });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Renamed: ${oldPath} -> ${newPath}`,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Hugo API
export async function hugoServer(
  projectPath: string,
  options?: {
    baseURL?: string;
    port?: number;
    bind?: string;
    buildDrafts?: boolean;
  }
): Promise<number> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const args = ['server'];
  if (options?.port) {
    args.push('--port', options.port.toString());
  }
  if (options?.bind) {
    args.push('--bind', options.bind);
  }
  if (options?.baseURL) {
    args.push('--baseURL', options.baseURL);
  }
  if (options?.buildDrafts) {
    args.push('--buildDrafts');
  }

  const commandId = addCommand({
    command: 'hugo',
    args,
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    const port = await invoke<number>('hugo_server', {
      projectPath,
      baseURL: options?.baseURL,
      port: options?.port,
      bind: options?.bind,
      buildDrafts: options?.buildDrafts,
    });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Hugo server started on http://${options?.bind || '127.0.0.1'}:${port}`,
      duration: Date.now() - startTime,
    });
    return port;
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function stopHugoServer(): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'stop_hugo_server',
    args: [],
    cwd: '',
    stdout: '',
    stderr: '',
  });

  try {
    await invoke('stop_hugo_server');
    updateCommand(commandId, {
      status: 'success',
      stdout: 'Hugo server stopped',
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function hugoBuild(projectPath: string): Promise<CommandOutput> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'hugo',
    args: ['--gc', '--minify', '--buildDrafts'],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    const result = await invoke<CommandOutput>('hugo_build', { projectPath });
    updateCommand(commandId, {
      status: result.exit_code === 0 ? 'success' : 'error',
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exit_code ?? 0,
      duration: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function hugoNewContent(
  projectPath: string,
  contentPath: string,
  archetype?: string
): Promise<CommandOutput> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const args = archetype
    ? ['new', 'content', contentPath, '--kind', archetype]
    : ['new', 'content', contentPath];

  const commandId = addCommand({
    command: 'hugo',
    args,
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    const result = await invoke<CommandOutput>('hugo_new_content', { projectPath, contentPath, archetype });
    updateCommand(commandId, {
      status: result.exit_code === 0 ? 'success' : 'error',
      stdout: result.stdout || `Created: ${contentPath}`,
      stderr: result.stderr,
      exitCode: result.exit_code ?? 0,
      duration: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function executeCommand(
  projectPath: string,
  command: string,
  args: string[]
): Promise<CommandOutput> {
  return invoke('execute_command', { projectPath, command, args });
}

// Git API
export interface GitStatusResult {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
}

export interface GitCommit {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitBranch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

export async function gitStatus(projectPath: string): Promise<GitStatusResult> {
  return invoke('git_status', { projectPath });
}

export async function gitAdd(projectPath: string, files: string[]): Promise<string> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const args = ['add', ...files];
  const commandId = addCommand({
    command: 'git',
    args,
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    const result = await invoke<string>('git_add', { projectPath, files });
    updateCommand(commandId, {
      status: 'success',
      stdout: result,
      duration: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function gitReset(projectPath: string, files: string[]): Promise<string> {
  return invoke('git_reset', { projectPath, files });
}

export async function gitCommit(projectPath: string, message: string): Promise<string> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'git',
    args: ['commit', '-m', message],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    const result = await invoke<string>('git_commit', { projectPath, message });
    updateCommand(commandId, {
      status: 'success',
      stdout: result,
      duration: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function gitPush(projectPath: string): Promise<string> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'git',
    args: ['push'],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    const result = await invoke<string>('git_push', { projectPath });
    updateCommand(commandId, {
      status: 'success',
      stdout: result,
      duration: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function gitPull(projectPath: string): Promise<string> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'git',
    args: ['pull'],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    const result = await invoke<string>('git_pull', { projectPath });
    updateCommand(commandId, {
      status: 'success',
      stdout: result,
      duration: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function gitDiff(
  projectPath: string,
  file?: string,
  staged?: boolean
): Promise<string> {
  return invoke('git_diff', { projectPath, file, staged });
}

export async function gitLog(projectPath: string, count?: number): Promise<GitCommit[]> {
  return invoke('git_log', { projectPath, count });
}

export async function gitBranchList(projectPath: string): Promise<GitBranch[]> {
  return invoke('git_branch_list', { projectPath });
}

export async function gitCheckout(projectPath: string, branch: string): Promise<string> {
  return invoke('git_checkout', { projectPath, branch });
}

export async function gitCreateBranch(
  projectPath: string,
  branch: string,
  checkout?: boolean
): Promise<string> {
  return invoke('git_create_branch', { projectPath, branch, checkout });
}

// Settings API
export async function verifyHugoPath(hugoPath: string): Promise<string> {
  return invoke('verify_hugo_path', { hugoPath });
}

export async function detectHugoPath(): Promise<string | null> {
  return invoke('detect_hugo_path');
}

export async function isHugoAvailable(): Promise<boolean> {
  return invoke('is_hugo_available');
}

// Theme API
export interface ThemeInfo {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  source?: string;
  is_active: boolean;
  has_screenshot: boolean;
  path: string;
}

export interface OfficialTheme {
  name: string;
  description: string;
  repo: string;
  thumbnail: string;
  tags: string[];
}

export async function listThemes(projectPath: string): Promise<ThemeInfo[]> {
  return invoke('list_themes', { projectPath });
}

export async function getCurrentTheme(projectPath: string): Promise<string> {
  return invoke('get_current_theme', { projectPath });
}

export async function setTheme(projectPath: string, themeName: string): Promise<void> {
  return invoke('set_theme', { projectPath, themeName });
}

export async function installThemeGit(
  projectPath: string,
  gitUrl: string,
  themeName: string
): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'git',
    args: ['clone', gitUrl, `themes/${themeName}`],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    await invoke('install_theme_git', { projectPath, gitUrl, themeName });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Theme "${themeName}" installed successfully from ${gitUrl}`,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function uninstallTheme(projectPath: string, themeName: string): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'rm',
    args: ['-rf', `themes/${themeName}`],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  try {
    await invoke('uninstall_theme', { projectPath, themeName });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Theme "${themeName}" uninstalled`,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getOfficialThemes(): Promise<OfficialTheme[]> {
  return invoke('get_official_themes');
}

// Media API
export interface MediaFile {
  name: string;
  path: string;
  size: number;
  extension: string;
  is_image: boolean;
  modified: number;
}

export interface MediaDirectory {
  name: string;
  path: string;
  files: MediaFile[];
  subdirectories: string[];
}

export interface ImageInfo {
  path: string;
  size: number;
  width: number;
  height: number;
  extension: string;
}

export async function listMediaFiles(
  projectPath: string,
  subdirectory?: string
): Promise<MediaDirectory> {
  return invoke('list_media_files', { projectPath, subdirectory });
}

export async function deleteMediaFile(filePath: string): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'rm',
    args: [filePath],
    cwd: '',
    stdout: '',
    stderr: '',
  });

  try {
    await invoke('delete_media_file', { filePath });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Deleted: ${filePath}`,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function deleteMediaDirectory(dirPath: string): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'rm',
    args: ['-rf', dirPath],
    cwd: '',
    stdout: '',
    stderr: '',
  });

  try {
    await invoke('delete_media_directory', { dirPath });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Deleted directory: ${dirPath}`,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function renameMediaItem(oldPath: string, newName: string): Promise<string> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'mv',
    args: [oldPath, newName],
    cwd: '',
    stdout: '',
    stderr: '',
  });

  try {
    const result = await invoke<string>('rename_media_item', { oldPath, newName });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Renamed: ${oldPath} -> ${newName}`,
    });
    return result;
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function createMediaDirectory(
  projectPath: string,
  directoryName: string
): Promise<string> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'mkdir',
    args: ['-p', directoryName],
    cwd: `${projectPath}/static`,
    stdout: '',
    stderr: '',
  });

  try {
    const result = await invoke<string>('create_media_directory', { projectPath, directoryName });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Created directory: ${directoryName}`,
    });
    return result;
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getImageInfo(filePath: string): Promise<ImageInfo> {
  return invoke('get_image_info', { filePath });
}

export async function readImageBase64(filePath: string): Promise<string> {
  return invoke('read_image_base64', { filePath });
}

export async function uploadMediaFiles(
  projectPath: string,
  subdirectory: string | undefined,
  files: { name: string; content: string }[]
): Promise<string[]> {
  return invoke('upload_media_files', { projectPath, subdirectory, files });
}

// Theme ZIP Installation API
export async function installThemeZip(
  projectPath: string,
  zipPath: string,
  themeName: string
): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'unzip',
    args: [zipPath, '-d', `themes/${themeName}`],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    await invoke('install_theme_zip', { projectPath, zipPath, themeName });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Theme "${themeName}" installed from ${zipPath}`,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function installThemeFolder(
  projectPath: string,
  folderPath: string,
  themeName: string
): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'cp',
    args: ['-r', folderPath, `themes/${themeName}`],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    await invoke('install_theme_folder', { projectPath, folderPath, themeName });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Theme "${themeName}" installed from folder ${folderPath}`,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

export async function downloadAndInstallTheme(
  projectPath: string,
  url: string,
  themeName: string
): Promise<void> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  const commandId = addCommand({
    command: 'curl',
    args: ['-L', url, '-o', `themes/${themeName}.zip`],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  try {
    await invoke('download_and_install_theme', { projectPath, url, themeName });
    updateCommand(commandId, {
      status: 'success',
      stdout: `Theme "${themeName}" downloaded and installed from ${url}`,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

// Git Stash API
export interface GitStash {
  index: number;
  message: string;
  branch: string;
  hash: string;
}

export async function gitStashList(projectPath: string): Promise<GitStash[]> {
  return invoke('git_stash_list', { projectPath });
}

export async function gitStashSave(
  projectPath: string,
  message?: string
): Promise<string> {
  return invoke('git_stash_save', { projectPath, message });
}

export async function gitStashPop(
  projectPath: string,
  stashIndex?: number
): Promise<string> {
  return invoke('git_stash_pop', { projectPath, stashIndex });
}

export async function gitStashDrop(
  projectPath: string,
  stashIndex: number
): Promise<string> {
  return invoke('git_stash_drop', { projectPath, stashIndex });
}

export async function gitStashApply(
  projectPath: string,
  stashIndex?: number
): Promise<string> {
  return invoke('git_stash_apply', { projectPath, stashIndex });
}

// Git Tag API
export interface GitTag {
  name: string;
  hash: string;
  message?: string;
  date: string;
  tagger?: string;
}

export async function gitTagList(projectPath: string): Promise<GitTag[]> {
  return invoke('git_tag_list', { projectPath });
}

export async function gitTagCreate(
  projectPath: string,
  name: string,
  message?: string,
  commit?: string
): Promise<string> {
  return invoke('git_tag_create', { projectPath, name, message, commit });
}

export async function gitTagDelete(
  projectPath: string,
  name: string
): Promise<string> {
  return invoke('git_tag_delete', { projectPath, name });
}

export async function gitTagPush(
  projectPath: string,
  name?: string
): Promise<string> {
  return invoke('git_tag_push', { projectPath, name });
}

// Git Remote API
export interface GitRemote {
  name: string;
  url: string;
}

export async function gitRemoteList(projectPath: string): Promise<GitRemote[]> {
  return invoke('git_remote_list', { projectPath });
}

export async function gitRemoteAdd(
  projectPath: string,
  name: string,
  url: string
): Promise<string> {
  return invoke('git_remote_add', { projectPath, name, url });
}

export async function gitRemoteRemove(
  projectPath: string,
  name: string
): Promise<string> {
  return invoke('git_remote_remove', { projectPath, name });
}

// Git Init & Config API
export async function gitInit(projectPath: string): Promise<string> {
  return invoke('git_init', { projectPath });
}

export async function gitConfigGet(
  projectPath: string,
  key: string
): Promise<string> {
  return invoke('git_config_get', { projectPath, key });
}

export async function gitConfigSet(
  projectPath: string,
  key: string,
  value: string
): Promise<string> {
  return invoke('git_config_set', { projectPath, key, value });
}

export async function gitIsRepository(projectPath: string): Promise<boolean> {
  return invoke('git_is_repository', { projectPath });
}

// Theme Update API
export interface ThemeUpdateInfo {
  name: string;
  current_version?: string;
  latest_version?: string;
  has_update: boolean;
  source?: string;
}

export async function checkThemeUpdates(
  projectPath: string
): Promise<ThemeUpdateInfo[]> {
  return invoke('check_theme_updates', { projectPath });
}

export async function updateTheme(
  projectPath: string,
  themeName: string
): Promise<string> {
  return invoke('update_theme', { projectPath, themeName });
}

// Deploy API
export interface DeployConfig {
  repo_url: string;
  user_name: string;
  user_email: string;
  path_prefix: string; // Path prefix for static assets (e.g., "/blog")
}

export async function deployToPages(
  projectPath: string,
  repoUrl: string,
  userName: string,
  userEmail: string
): Promise<string> {
  const { addCommand, updateCommand } = useCommandHistoryStore.getState();

  // Add main deploy command to history
  const commandId = addCommand({
    command: 'deploy',
    args: ['to', 'pages'],
    cwd: projectPath,
    stdout: '',
    stderr: '',
  });

  const startTime = Date.now();

  // Track step command IDs
  const stepCommandIds = new Map<string, string>();

  // Listen for deploy progress events from Rust
  const unlisten = await listen<DeployProgressEvent>('deploy-progress', (event: Event<DeployProgressEvent>) => {
    const data = event.payload;
    const existingId = stepCommandIds.get(data.step);

    if (data.status === 'running') {
      // Add the sub-command to history
      const stepId = addCommand({
        command: data.command,
        args: data.args,
        cwd: data.cwd,
        stdout: data.stdout,
        stderr: data.stderr,
      });
      stepCommandIds.set(data.step, stepId);
    } else if (existingId) {
      // Update the sub-command with result
      updateCommand(existingId, {
        status: data.status,
        stdout: data.stdout,
        stderr: data.stderr,
        exitCode: data.status === 'success' ? 0 : 1,
      });
    }
  });

  try {
    const result = await invoke<string>('deploy_to_pages', {
      projectPath,
      repoUrl,
      userName,
      userEmail,
    });

    // Update main command with success
    updateCommand(commandId, {
      status: 'success',
      stdout: result,
      exitCode: 0,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    // Update command with error
    updateCommand(commandId, {
      status: 'error',
      stderr: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  } finally {
    // Clean up the event listener
    unlisten();
  }
}

export async function saveDeployConfig(
  projectPath: string,
  config: DeployConfig
): Promise<void> {
  return invoke('save_deploy_config', { projectPath, config });
}

export async function loadDeployConfig(
  projectPath: string
): Promise<DeployConfig | null> {
  return invoke('load_deploy_config', { projectPath });
}

// Open external URL in system default browser
export async function openExternalUrl(url: string): Promise<void> {
  return invoke('open_url', { url });
}

// Open preview window for Hugo server
export async function openPreviewWindow(port: number): Promise<void> {
  return invoke('open_preview_window', { port });
}

// Close preview window if it exists
export async function closePreviewWindow(): Promise<void> {
  return invoke('close_preview_window');
}

// Import types for file opening
import type { ContentFile } from '@/types';
import YAML from 'yaml';

/**
 * Open a file in editor by path
 * Reads the file, parses frontmatter, and returns ContentFile object
 * Caller should update projectStore.setSelectedFile and editorStore.openFile
 */
export async function openFileInEditor(
  path: string,
  currentProjectPath: string
): Promise<ContentFile> {
  // Normalize path for consistency
  const normalizedPath = path.replace(/\\/g, '/');

  // Read file content
  const content = await readFile(normalizedPath);

  // Parse frontmatter and body
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  let frontmatter: Record<string, unknown> = {};
  let body = content;

  if (frontmatterMatch) {
    const frontmatterContent = frontmatterMatch[1];
    body = frontmatterMatch[2] || '';

    // Use YAML library to properly parse frontmatter
    try {
      frontmatter = YAML.parse(frontmatterContent) || {};
    } catch (err) {
      console.error('Failed to parse frontmatter:', err);
      // Fallback to simple parsing if YAML parse fails
      frontmatterContent.split('\n').forEach((line) => {
        const match = line.match(/^([\w-]+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          frontmatter[key] = value.replace(/^["']|["']$/g, '');
        }
      });
    }
  }

  const fileName = normalizedPath.split('/').pop() || '';
  const slug = fileName.replace(/\.md$/, '');

  const contentFile: ContentFile = {
    path: normalizedPath,
    slug,
    title: (frontmatter.title as string) || slug,
    draft: frontmatter.draft === true || frontmatter.draft === 'true',
    date: frontmatter.date as string,
    frontmatter,
    body: content,
    wordCount: body.split(/\s+/).length,
  };

  return contentFile;
}

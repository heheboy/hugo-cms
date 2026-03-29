import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import YAML from 'yaml';
import { usePreventReload } from '@/hooks/usePreventReload';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Editor } from '@/components/editor/Editor';
import { Terminal } from '@/components/terminal/Terminal';
import { ThemeInstallPrompt } from '@/components/theme/ThemeInstallPrompt';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  openProjectDialog,
  createSiteDialog,
  openProject,
  hugoServer,
  stopHugoServer,
  hugoBuild,
  buildFileTree,
  executeCommandWithHistory,
  readFile,
  writeFile,
  deployToPages,
  loadDeployConfig,
  openPreviewWindow,
  closePreviewWindow,
} from '@/hooks/useTauri';

// Theme provider to handle dark/light mode
function useTheme() {
  const { settings } = useSettingsStore();
  const theme = settings.appearance.theme;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);
}

function App() {
  const { t } = useTranslation();
  usePreventReload(); // 全局阻止 F5 刷新和默认右键菜单
  useTheme(); // Apply theme from settings
  const [isPreviewRunning, setIsPreviewRunning] = useState(false);
  const [previewPort, setPreviewPort] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Theme install prompt state
  const [isThemePromptOpen, setIsThemePromptOpen] = useState(false);
  const [missingTheme, setMissingTheme] = useState<string | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'files' | 'media' | 'stats'>('files');
  const {
    currentProject,
    setCurrentProject,
    setFileTree,
    setError,
    error,
    setSelectedFile,
  } = useProjectStore();
  const { openFile } = useEditorStore();
  const { settings } = useSettingsStore();

  // Load file tree when project changes
  useEffect(() => {
    if (currentProject) {
      loadFileTree();
    }
  }, [currentProject]);

  // Listen for preview window closed event
  useEffect(() => {
    const unsubscribe = listen('preview-window-closed', () => {
      console.log('Preview window closed, updating state');
      setIsPreviewRunning(false);
      setPreviewPort(null);
    });

    return () => {
      unsubscribe.then((fn) => fn());
    };
  }, []);

  const loadFileTree = async () => {
    if (!currentProject) return;
    try {
      const tree = await buildFileTree(currentProject.path);
      setFileTree(tree);
    } catch (err) {
      console.error('Failed to load file tree:', err);
    }
  };

  const handleOpenProject = useCallback(async () => {
    try {
      const path = await openProjectDialog();
      if (!path) return;

      setIsLoading(true);
      const project = await openProject(path);
      setCurrentProject(project);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.openProject'));
    } finally {
      setIsLoading(false);
    }
  }, [setCurrentProject, setError]);

  // Create new Hugo site
  const handleCreateProject = useCallback(async () => {
    try {
      const path = await createSiteDialog();
      if (!path) return;

      setIsLoading(true);

      // Get Hugo path from settings or use default
      const hugoPath = settings.hugoPath?.trim() || 'hugo';

      // Initialize new Hugo site
      await executeCommandWithHistory(path, hugoPath, ['new', 'site', '.', '--force']);

      // Create basic config (without theme - user can install later)
      const configContent = `baseURL = 'https://example.org/'
languageCode = 'en-US'
title = 'My New Hugo Site'
`;
      const fs = await import('@tauri-apps/plugin-fs');
      // Normalize path - ensure forward slashes for Tauri API
      const normalizedPath = path.replace(/\\/g, '/');
      await fs.writeTextFile(normalizedPath + '/hugo.toml', configContent);

      // Create archetypes directory first
      await fs.mkdir(normalizedPath + '/archetypes', { recursive: true });

      // 1. default.md - 通用页面模板
      const defaultArchetype = `---
date: '{{ .Date }}'
draft: true
title: '{{ replace .File.ContentBaseName "-" " " | title }}'
---
`;
      await writeFile(normalizedPath + '/archetypes/default.md', defaultArchetype);

      // 2. posts.md - 博客文章模板
      const postsArchetype = `---
date: '{{ .Date }}'
draft: true
title: '{{ replace .File.ContentBaseName "-" " " | title }}'
tags: []
categories: []
---
`;
      await writeFile(normalizedPath + '/archetypes/posts.md', postsArchetype);

      // 3. docs.md - 文档页面模板
      const docsArchetype = `---
date: '{{ .Date }}'
draft: true
title: '{{ replace .File.ContentBaseName "-" " " | title }}'
description: ''
weight: 10
---
`;
      await writeFile(normalizedPath + '/archetypes/docs.md', docsArchetype);

      // 4. projects.md - 项目展示模板
      const projectsArchetype = `---
date: '{{ .Date }}'
draft: true
title: '{{ replace .File.ContentBaseName "-" " " | title }}'
description: ''
github: ''
demo: ''
tech: []
---
`;
      await writeFile(normalizedPath + '/archetypes/projects.md', projectsArchetype);

      // Create static subdirectories for media management
      await fs.mkdir(normalizedPath + '/static/images', { recursive: true });
      await fs.mkdir(normalizedPath + '/static/attachments', { recursive: true });

      // Open the new project
      const project = await openProject(path);
      setCurrentProject(project);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // Check if Hugo is not installed - look for specific "command not found" patterns
      const isHugoNotFound =
        errorMsg.includes('not found') ||
        errorMsg.includes('not recognized') ||
        errorMsg.includes('cannot find') ||
        errorMsg.includes('No such file') ||
        errorMsg.includes('系统找不到') ||
        errorMsg.includes('不是内部或外部命令') ||
        (errorMsg.includes('Failed to execute') && errorMsg.includes('hugo'));

      if (isHugoNotFound) {
        setError(t('app.errors.hugoNotInstalled'));
      } else {
        setError(t('app.errors.createProjectDetail', { error: errorMsg }));
      }
    } finally {
      setIsLoading(false);
    }
  }, [setCurrentProject, setError]);

  const handlePreview = useCallback(async () => {
    if (!currentProject) return;

    try {
      if (isPreviewRunning) {
        // Close preview window and stop server
        await closePreviewWindow();
        await stopHugoServer();
        setIsPreviewRunning(false);
        setPreviewPort(null);
      } else {
        // Check if theme is configured before starting preview
        try {
          const configPath = currentProject.path + '/hugo.toml';
          const configContent = await readFile(configPath);
          const hasTheme = configContent.includes('theme') && configContent.match(/theme\s*=\s*['"][^'"]+['"]/);

          if (!hasTheme) {
            setMissingTheme(''); // Empty indicates no theme
            setIsThemePromptOpen(true);
            return;
          }
        } catch {
          // If can't read config, try to start anyway and let Hugo report the error
        }

        // Load deploy config to get path prefix for local preview
        let previewBaseURL: string | undefined;
        try {
          const deployConfig = await loadDeployConfig(currentProject.path);
          if (deployConfig?.path_prefix) {
            // Use path prefix for local preview to match deployment structure
            previewBaseURL = `http://127.0.0.1:${deployConfig.path_prefix}`;
          }
        } catch {
          // Ignore error if no deploy config
        }

        const port = await hugoServer(currentProject.path, previewBaseURL);
        setIsPreviewRunning(true);
        setPreviewPort(port);

        // Open preview window
        await openPreviewWindow(port);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to toggle preview:', err);

      // Check for theme missing error
      const themeMissingMatch = errorMsg.match(/THEME_MISSING:([^:]+):/);
      if (themeMissingMatch) {
        const themeName = themeMissingMatch[1];
        setMissingTheme(themeName);
        setIsThemePromptOpen(true);
        return;
      }

      // Check for other theme-related errors
      if (errorMsg.includes('no theme') ||
          errorMsg.includes('theme not set') ||
          errorMsg.includes('unable to locate theme') ||
          errorMsg.includes('could not locate theme')) {
        setMissingTheme(''); // Empty theme name indicates no theme configured
        setIsThemePromptOpen(true);
        return;
      }

      setError(`${t('app.errors.startPreview')}: ${errorMsg}`);
    }
  }, [currentProject, isPreviewRunning, setError]);

  const handleOpenFile = useCallback(async (path: string) => {
    if (!currentProject) return;

    console.log('=== handleOpenFile called ===');
    console.log('Opening path:', path);
    console.log('Current project path:', currentProject.path);

    // Normalize path - ensure consistent separators
    const normalizedPath = path.replace(/\\/g, '/');
    console.log('Normalized path:', normalizedPath);

    try {
      console.log('[handleOpenFile] Reading file:', normalizedPath);
      const content = await readFile(normalizedPath);
      console.log('[handleOpenFile] File content length:', content?.length);
      console.log('[handleOpenFile] File content preview:', content?.substring(0, 100));

      if (!content) {
        console.error('[handleOpenFile] Content is empty!');
      }

      // Parse frontmatter and body for metadata, but keep full content as body
      const frontmatterMatch = content?.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

      let frontmatter: Record<string, unknown> = {};
      let bodyOnly = '';

      if (frontmatterMatch) {
        const frontmatterContent = frontmatterMatch[1];
        bodyOnly = frontmatterMatch[2] || ''; // Handle files with only frontmatter

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

      const fileName = path.split('/').pop() || '';
      const slug = fileName.replace(/\.md$/, '');

      const contentFile = {
        path: normalizedPath,
        slug,
        title: (frontmatter.title as string) || slug,
        draft: frontmatter.draft === true || frontmatter.draft === 'true',
        date: frontmatter.date as string,
        frontmatter,
        body: content || '', // Store full content including frontmatter
        wordCount: bodyOnly.split(/\s+/).length,
      };

      console.log('[handleOpenFile] contentFile created with body length:', contentFile.body?.length);
      console.log('[handleOpenFile] contentFile.body preview:', contentFile.body?.substring(0, 100));

      setSelectedFile(contentFile);
      // Also open in editor store so it can be saved
      console.log('[handleOpenFile] Calling openFile with contentFile');
      openFile(contentFile);
    } catch (err) {
      console.error('Failed to open file:', err);
      setError('Failed to open file');
    }
  }, [currentProject, setSelectedFile, openFile, setError]);

  const handleEditConfig = useCallback(async () => {
    if (currentProject) {
      const configPath = currentProject.path + '/hugo.toml';
      try {
        const content = await readFile(configPath);
        const file = {
          path: configPath,
          slug: 'hugo',
          title: 'Hugo Config',
          draft: false,
          frontmatter: {},
          body: content,
          wordCount: content.split(/\s+/).length,
        };
        setSelectedFile(file);
        // Also open in editor store so activeFilePath is set
        openFile(file);
      } catch (err) {
        console.error('Failed to read hugo.toml:', err);
        setError('Failed to open hugo.toml');
      }
    }
  }, [currentProject, setSelectedFile, openFile, setError]);

  const handleDeploy = useCallback(async () => {
    if (!currentProject) return;

    console.log('=== Deploy started ===');
    console.log('Project path:', currentProject.path);

    try {
      setIsLoading(true);
      setError(null);

      // Load deploy config
      const config = await loadDeployConfig(currentProject.path);
      if (!config) {
        setError(t('app.errors.deployNoConfig', '未配置部署仓库，请先在设置中配置部署仓库'));
        return;
      }

      // Deploy to pages
      console.log('Deploying to pages...');
      const result = await deployToPages(
        currentProject.path,
        config.repo_url,
        config.user_name,
        config.user_email
      );
      console.log('Deploy result:', result);

      // Show success
      alert(t('app.git.deploySuccess', '部署成功！'));
    } catch (err) {
      console.error('Deploy error:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(t('app.errors.deployDetail', { error: errorMsg }));
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, setError, t]);

  const handleCloseProject = useCallback(() => {
    // Stop preview if running
    if (isPreviewRunning) {
      closePreviewWindow();
      stopHugoServer();
      setIsPreviewRunning(false);
      setPreviewPort(null);
    }
    // Clear project and file tree
    setCurrentProject(null);
    setFileTree([]);
    setSelectedFile(null);
    // Clear editor state - close all open files
    const { openFiles } = useEditorStore.getState();
    openFiles.forEach(file => {
      useEditorStore.getState().closeFile(file.path);
    });
  }, [isPreviewRunning, setCurrentProject, setFileTree, setSelectedFile]);

  const handleBuild = useCallback(async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      const result = await hugoBuild(currentProject.path);
      console.log('Build output:', result.stdout);
      if (result.stderr) {
        console.error('Build errors:', result.stderr);
      }
      // Refresh file tree after successful build
      await loadFileTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.build'));
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, setError, t, loadFileTree]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {error && (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm flex items-center justify-between">
          <span>{t('common.status.error')}: {error}</span>
          <button onClick={() => setError(null)} className="hover:opacity-80">✕</button>
        </div>
      )}
      <Header
        onPreview={handlePreview}
        onBuild={handleBuild}
        onDeploy={handleDeploy}
        isPreviewRunning={isPreviewRunning}
        onRefreshFileTree={loadFileTree}
        onOpenFile={handleOpenFile}
        onCloseProject={handleCloseProject}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          onOpenProject={handleOpenProject}
          onCreateProject={handleCreateProject}
          isLoading={isLoading}
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
        />
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <Editor />
          <Terminal projectPath={currentProject?.path || null} />
        </div>
      </div>

      {/* Theme Install Prompt */}
      <ThemeInstallPrompt
        isOpen={isThemePromptOpen}
        onClose={() => setIsThemePromptOpen(false)}
        missingTheme={missingTheme}
        onThemeInstalled={() => {
          // Retry preview after theme is installed
          setIsThemePromptOpen(false);
          handlePreview();
        }}
        onEditConfig={handleEditConfig}
      />
    </div>
  );
}

export default App;

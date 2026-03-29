import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import YAML from 'yaml';
import {
  FolderOpen,
  FileText,
  Image,
  Palette,
  Settings,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  FolderPlus,
  Scissors,
  Copy,
  ClipboardPaste,
  Edit3,
  Trash2,
  FilePlus,
  FolderPlus as FolderNew,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  readFile,
  buildFileTree,
  createDirectory,
  deleteFile,
  renameFile,
  writeFile,
} from '@/hooks/useTauri';
import type { FileNode } from '@/types';
import { isMarkdownFile } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { ThemeManager } from '@/components/theme/ThemeManager';
import { StatisticsPanel } from '@/components/stats/StatisticsPanel';
import { MediaBrowser } from '@/components/media/MediaBrowser';

interface SidebarProps {
  onOpenProject: () => void;
  onCreateProject: () => void;
  isLoading?: boolean;
  activeTab?: 'files' | 'media' | 'stats';
  onTabChange?: (tab: 'files' | 'media' | 'stats') => void;
}

interface FileTreeNodeProps {
  node: FileNode;
  level?: number;
  onFileClick: (path: string) => void;
  selectedPath?: string | null;
  onRefresh: () => Promise<void>;
  clipboard: { path: string; operation: 'cut' | 'copy' } | null;
  setClipboard: (clipboard: { path: string; operation: 'cut' | 'copy' } | null) => void;
  onRename: (path: string, currentName: string) => void;
  onNewFile: (dirPath: string) => void;
  onNewFolder: (dirPath: string) => void;
}

// Clipboard storage key
const CLIPBOARD_STORAGE_KEY = 'hugo-cms-file-clipboard';

function FileTreeNode({
  node,
  level = 0,
  onFileClick,
  selectedPath,
  onRefresh,
  clipboard,
  setClipboard,
  onRename,
  onNewFile,
  onNewFolder,
}: FileTreeNodeProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [isExpanded, setIsExpanded] = useState(level < 1);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (node.file_type === 'error') {
      // Error nodes are not clickable
      return;
    }
    if (node.file_type === 'directory') {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick(node.path);
    }
  };

  // File operations
  const handleCut = async () => {
    if (!currentProject || node.file_type === 'error') return;
    const item = { path: node.path, operation: 'cut' as const };
    setClipboard(item);
    localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(item));
  };

  const handleCopy = async () => {
    if (!currentProject || node.file_type === 'error') return;
    const item = { path: node.path, operation: 'copy' as const };
    setClipboard(item);
    localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(item));
    // Silent copy - no alert
  };

  const handlePaste = async () => {
    if (!currentProject || !clipboard || node.file_type === 'error') return;

    try {
      const path = await import('@tauri-apps/api/path');

      const sourceName = clipboard.path.split(/[/\\]/).pop() || '';
      const targetDir = node.file_type === 'directory' ? node.path : await path.dirname(node.path);
      const targetPath = await path.join(targetDir, sourceName);

      if (clipboard.operation === 'cut') {
        // Move file
        await renameFile(clipboard.path, targetPath);
        setClipboard(null);
        localStorage.removeItem(CLIPBOARD_STORAGE_KEY);
      } else if (clipboard.operation === 'copy') {
        // Copy file content - read then write
        const content = await readFile(clipboard.path);
        await writeFile(targetPath, content);
      }

      await onRefresh();
    } catch (err) {
      console.error('Paste operation failed:', err);
      alert(t('sidebar.contextMenu.pasteFailed', '粘贴操作失败'));
    }
  };

  const handleDelete = async () => {
    if (!currentProject || node.file_type === 'error') return;

    try {
      await deleteFile(node.path);
      await onRefresh();
    } catch (err) {
      console.error('Delete operation failed:', err);
      // Silent fail - no alert
    }
  };

  const handleRename = () => {
    onRename(node.path, node.name);
  };

  const handleNewFile = () => {
    const dirPath = node.file_type === 'directory' ? node.path : '';
    onNewFile(dirPath);
  };

  const handleNewFolder = () => {
    const dirPath = node.file_type === 'directory' ? node.path : '';
    onNewFolder(dirPath);
  };

  const canPaste = clipboard && node.file_type === 'directory' && clipboard.path !== node.path;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={handleClick}
            className={`flex items-center w-full px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm ${
              isSelected ? 'bg-accent text-accent-foreground' : ''
            } ${node.file_type === 'error' ? 'text-red-500' : ''}`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            title={node.error || node.name}
          >
            {node.file_type === 'directory' && (
              <span className="mr-1">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
            )}
            {node.file_type === 'error' ? (
              <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
            ) : node.file_type === 'directory' ? (
              <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
            ) : isMarkdownFile(node.name) ? (
              <FileText className="h-4 w-4 mr-2 text-blue-500" />
            ) : (
              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
            )}
            <span className="truncate">{node.name}</span>
            {node.error && (
              <span className="ml-2 text-xs text-red-500 truncate" title={node.error}>
                ⚠️
              </span>
            )}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {node.file_type === 'error' ? (
            // Error node menu - only show error info
            <ContextMenuItem disabled>
              <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
              {t('sidebar.contextMenu.error', '访问错误')}
            </ContextMenuItem>
          ) : (
            <>
              {/* File/Folder operations */}
              {node.file_type === 'directory' && (
                <>
                  <ContextMenuItem onClick={handleNewFile}>
                    <FilePlus className="h-4 w-4 mr-2" />
                    {t('sidebar.contextMenu.newFile', '新建文件')}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleNewFolder}>
                    <FolderNew className="h-4 w-4 mr-2" />
                    {t('sidebar.contextMenu.newFolder', '新建文件夹')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}

              {/* Clipboard operations */}
              <ContextMenuItem onClick={handleCut}>
                <Scissors className="h-4 w-4 mr-2" />
                {t('sidebar.contextMenu.cut', '剪切')}
              </ContextMenuItem>
              <ContextMenuItem onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                {t('sidebar.contextMenu.copy', '复制')}
              </ContextMenuItem>
              {node.file_type === 'directory' && (
                <ContextMenuItem
                  onClick={handlePaste}
                  disabled={!canPaste}
                  className={!canPaste ? 'opacity-50 pointer-events-none' : ''}
                >
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  {t('sidebar.contextMenu.paste', '粘贴')}
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />

              {/* Rename and Delete */}
              <ContextMenuItem onClick={handleRename}>
                <Edit3 className="h-4 w-4 mr-2" />
                {t('sidebar.contextMenu.rename', '重命名')}
              </ContextMenuItem>
              <ContextMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('sidebar.contextMenu.delete', '删除')}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
              selectedPath={selectedPath}
              onRefresh={onRefresh}
              clipboard={clipboard}
              setClipboard={setClipboard}
              onRename={onRename}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ onOpenProject, onCreateProject, isLoading, activeTab: externalActiveTab, onTabChange }: SidebarProps) {
  const { t } = useTranslation();
  const [internalActiveTab, setInternalActiveTab] = useState<'files' | 'media' | 'stats'>('files');
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = onTabChange ?? setInternalActiveTab;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeManagerOpen, setIsThemeManagerOpen] = useState(false);
  const {
    currentProject,
    fileTree,
    setFileTree,
    selectedFile,
    setSelectedFile,
  } = useProjectStore();
  const { openFile } = useEditorStore();
  const { settings, updateAppearanceSettings } = useSettingsStore();
  const { appearance } = settings;

  // Clipboard state for file operations
  const [clipboard, setClipboard] = useState<{ path: string; operation: 'cut' | 'copy' } | null>(null);

  // Dialog states
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamePath, setRenamePath] = useState('');
  const [renameCurrentName, setRenameCurrentName] = useState('');
  const [renameNewName, setRenameNewName] = useState('');

  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileDirPath, setNewFileDirPath] = useState('');
  const [newFileName, setNewFileName] = useState('');

  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderDirPath, setNewFolderDirPath] = useState('');
  const [newFolderName, setNewFolderName] = useState('');

  // Load clipboard from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(CLIPBOARD_STORAGE_KEY);
    if (saved) {
      try {
        setClipboard(JSON.parse(saved));
      } catch {
        localStorage.removeItem(CLIPBOARD_STORAGE_KEY);
      }
    }
  }, []);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const updateAppearanceSettingsRef = useRef(updateAppearanceSettings);

  // Keep the ref updated
  useEffect(() => {
    updateAppearanceSettingsRef.current = updateAppearanceSettings;
  }, [updateAppearanceSettings]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle resize during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX, 200), 400);
      updateAppearanceSettingsRef.current({ sidebarWidth: newWidth });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Listen for open-theme-manager event
  useEffect(() => {
    const handleOpenThemeManager = () => {
      setIsThemeManagerOpen(true);
    };
    window.addEventListener('open-theme-manager', handleOpenThemeManager);
    return () => {
      window.removeEventListener('open-theme-manager', handleOpenThemeManager);
    };
  }, []);

  const handleFileClick = useCallback(async (path: string) => {
    if (!currentProject) return;

    console.log('=== handleFileClick ===');
    console.log('Raw path:', path);

    // Normalize path for consistency
    const normalizedPath = path.replace(/\\/g, '/');
    console.log('Normalized path:', normalizedPath);

    try {
      const content = await readFile(normalizedPath);
      // Parse frontmatter and body
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

      let frontmatter: Record<string, unknown> = {};
      let body = content;

      if (frontmatterMatch) {
        const frontmatterContent = frontmatterMatch[1];
        body = frontmatterMatch[2] || ''; // Handle files with only frontmatter

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
        body: content, // Store full content including frontmatter
        wordCount: body.split(/\s+/).length,
      };

      setSelectedFile(contentFile);
      // Also open in editor store so it can be saved
      openFile(contentFile);
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }, [currentProject, setSelectedFile, openFile]);

  const handleRefresh = useCallback(async () => {
    if (currentProject) {
      // Reload file tree without refreshing the whole page
      try {
        const tree = await buildFileTree(currentProject.path);
        setFileTree(tree);
      } catch (err) {
        console.error('Failed to refresh file tree:', err);
      }
    }
  }, [currentProject, setFileTree]);

  // Rename handlers
  const handleRenameOpen = useCallback((path: string, currentName: string) => {
    setRenamePath(path);
    setRenameCurrentName(currentName);
    setRenameNewName(currentName);
    setRenameDialogOpen(true);
  }, []);

  const handleRenameConfirm = async () => {
    if (!renamePath || !renameNewName || renameNewName === renameCurrentName) {
      setRenameDialogOpen(false);
      return;
    }

    try {
      const path = await import('@tauri-apps/api/path');
      const parentDir = await path.dirname(renamePath);
      const newPath = await path.join(parentDir, renameNewName);
      await renameFile(renamePath, newPath);
      await handleRefresh();
      setRenameDialogOpen(false);
    } catch (err) {
      console.error('Rename failed:', err);
      alert(t('sidebar.contextMenu.renameFailed', '重命名失败'));
    }
  };

  // New file handlers
  const handleNewFileOpen = useCallback((dirPath: string) => {
    setNewFileDirPath(dirPath);
    setNewFileName('');
    setNewFileDialogOpen(true);
  }, []);

  const handleNewFileConfirm = async () => {
    if (!newFileDirPath || !newFileName) {
      setNewFileDialogOpen(false);
      return;
    }

    try {
      const path = await import('@tauri-apps/api/path');
      const filePath = await path.join(newFileDirPath, newFileName);
      // Create empty file or with basic frontmatter if markdown
      const content = newFileName.endsWith('.md')
        ? '---\ndate: \'' + new Date().toISOString() + '\'\ndraft: true\ntitle: \'' + newFileName.replace(/\.md$/, '') + '\'\n---\n'
        : '';
      await writeFile(filePath, content);
      await handleRefresh();
      setNewFileDialogOpen(false);
    } catch (err) {
      console.error('Create file failed:', err);
      alert(t('sidebar.contextMenu.createFileFailed', '创建文件失败'));
    }
  };

  // New folder handlers
  const handleNewFolderOpen = useCallback((dirPath: string) => {
    setNewFolderDirPath(dirPath);
    setNewFolderName('');
    setNewFolderDialogOpen(true);
  }, []);

  const handleNewFolderConfirm = async () => {
    if (!newFolderDirPath || !newFolderName) {
      setNewFolderDialogOpen(false);
      return;
    }

    try {
      const path = await import('@tauri-apps/api/path');
      const folderPath = await path.join(newFolderDirPath, newFolderName);
      await createDirectory(folderPath);
      await handleRefresh();
      setNewFolderDialogOpen(false);
    } catch (err) {
      console.error('Create folder failed:', err);
      alert(t('sidebar.contextMenu.createFolderFailed', '创建文件夹失败'));
    }
  };

  const sidebarWidth = appearance.sidebarWidth;
  const isCompact = sidebarWidth < 240;

  return (
    <>
      <div
        ref={sidebarRef}
        className="h-full flex flex-col border-r bg-card relative group"
        style={{ width: sidebarWidth }}
      >
        {/* Resize Handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-50 opacity-0 group-hover:opacity-100"
          onMouseDown={handleResizeStart}
          style={{ transform: 'translateX(50%)' }}
        />

        {/* Header */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm truncate">
              {currentProject?.name || t('sidebar.project.noProject')}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {isCompact ? (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="flex-1"
                        onClick={onOpenProject}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FolderOpen className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{t('sidebar.project.openProject')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="icon"
                        className="flex-1"
                        onClick={onCreateProject}
                        disabled={isLoading}
                      >
                        <FolderPlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{t('sidebar.project.newSite')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={onOpenProject}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4 mr-2" />
                  )}
                  <span className="truncate">{t('sidebar.project.openProject')}</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={onCreateProject}
                  disabled={isLoading}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  <span className="truncate">{t('sidebar.project.newSite')}</span>
                </Button>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Tab Navigation */}
        <div className="flex px-2 py-2 gap-1">
          <Button
            variant={activeTab === 'files' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setActiveTab('files')}
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTab === 'media' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setActiveTab('media')}
          >
            <Image className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTab === 'stats' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setActiveTab('stats')}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-2">
          {activeTab === 'files' && (
            <div data-custom-context-menu>
              {fileTree.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {currentProject ? t('sidebar.empty.noFiles') : t('sidebar.empty.openPrompt')}
                </div>
              ) : (
                fileTree.map((node) => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    onFileClick={handleFileClick}
                    selectedPath={selectedFile?.path}
                    onRefresh={handleRefresh}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    onRename={handleRenameOpen}
                    onNewFile={handleNewFileOpen}
                    onNewFolder={handleNewFolderOpen}
                  />
                ))
              )}
            </div>
          )}
          {activeTab === 'media' && (
            <div className="h-full" data-custom-context-menu>
              <MediaBrowser />
            </div>
          )}
          {activeTab === 'stats' && (
            <div className="h-full">
              <StatisticsPanel />
            </div>
          )}
        </div>

        {/* Footer */}
        <Separator />
        <TooltipProvider>
          <div className="p-2 flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-1"
                  onClick={handleRefresh}
                  disabled={!currentProject}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              {!currentProject ? (
                <TooltipContent>
                  <p>{t('sidebar.empty.openPrompt')}</p>
                </TooltipContent>
              ) : (
                <TooltipContent>
                  <p>{t('common.actions.refresh')}</p>
                </TooltipContent>
              )}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-1"
                  onClick={() => setIsThemeManagerOpen(true)}
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('theme.title')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-1"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('settings.title')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
        <ThemeManager open={isThemeManagerOpen} onOpenChange={setIsThemeManagerOpen} />
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sidebar.contextMenu.rename', '重命名')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newName">{t('sidebar.dialog.newName', '新名称')}</Label>
            <Input
              id="newName"
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
              placeholder={t('sidebar.dialog.namePlaceholder', '输入新名称')}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              {t('common.actions.cancel', '取消')}
            </Button>
            <Button onClick={handleRenameConfirm} disabled={!renameNewName || renameNewName === renameCurrentName}>
              {t('common.actions.confirm', '确认')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sidebar.contextMenu.newFile', '新建文件')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="fileName">{t('sidebar.dialog.fileName', '文件名')}</Label>
            <Input
              id="fileName"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder={t('sidebar.dialog.fileNamePlaceholder', '输入文件名（如：post.md）')}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileDialogOpen(false)}>
              {t('common.actions.cancel', '取消')}
            </Button>
            <Button onClick={handleNewFileConfirm} disabled={!newFileName}>
              {t('common.actions.create', '创建')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sidebar.contextMenu.newFolder', '新建文件夹')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folderName">{t('sidebar.dialog.folderName', '文件夹名称')}</Label>
            <Input
              id="folderName"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('sidebar.dialog.folderNamePlaceholder', '输入文件夹名称')}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
              {t('common.actions.cancel', '取消')}
            </Button>
            <Button onClick={handleNewFolderConfirm} disabled={!newFolderName}>
              {t('common.actions.create', '创建')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

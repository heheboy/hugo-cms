import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Square,
  RefreshCw,
  Upload,
  Plus,
  ExternalLink,
  Globe,
  Settings,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { hugoNewContent, readFile, listDirectory } from '@/hooks/useTauri';
import type { CommandOutput } from '@/types';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { DeployConfigDialog } from '@/components/git/DeployConfigDialog';

interface HeaderProps {
  onPreview: () => void;
  onBuild: () => void;
  onDeploy: () => void;
  isPreviewRunning: boolean;
  previewPort?: number | null;
  onRefreshFileTree?: () => Promise<void>;
  onOpenFile?: (path: string) => void;
  onCloseProject?: () => void;
}

export function Header({
  onPreview,
  onBuild,
  onDeploy,
  isPreviewRunning,
  previewPort,
  onRefreshFileTree,
  onOpenFile,
  onCloseProject,
}: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { currentProject, selectedFile } = useProjectStore();
  const { isDirty } = useEditorStore();
  const [isNewPostDialogOpen, setIsNewPostDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeployConfigOpen, setIsDeployConfigOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [selectedArchetype, setSelectedArchetype] = useState('posts');
  const [availableArchetypes, setAvailableArchetypes] = useState<string[]>(['default', 'posts']);
  const [isCreating, setIsCreating] = useState(false);

  // Generate slug function - used for display and actual creation
  const generateSlug = (title: string): string => {
    return title
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '') // Keep all Unicode letters (including Chinese) and numbers
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, ''); // Trim leading/trailing dashes
  };

  // Load available archetypes when dialog opens
  useEffect(() => {
    if (isNewPostDialogOpen && currentProject) {
      loadArchetypes();
    }
  }, [isNewPostDialogOpen, currentProject]);

  const loadArchetypes = async () => {
    if (!currentProject) return;
    try {
      const archetypesPath = `${currentProject.path}/archetypes`;
      const files = await listDirectory(archetypesPath);
      // Filter only .md files and remove extension
      const archetypeNames = files
        .filter(f => f.name.endsWith('.md'))
        .map(f => f.name.replace('.md', ''));
      if (archetypeNames.length > 0) {
        setAvailableArchetypes(archetypeNames);
        // Default to 'posts' if available, otherwise first one
        if (archetypeNames.includes('posts')) {
          setSelectedArchetype('posts');
        } else {
          setSelectedArchetype(archetypeNames[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load archetypes:', err);
      // Fallback to default
      setAvailableArchetypes(['default', 'posts']);
    }
  };

  const handleCreatePost = async () => {
    if (!currentProject || !newPostTitle.trim()) return;

    try {
      setIsCreating(true);
      // Generate slug using the same function
      const slug = generateSlug(newPostTitle);

      let contentPath: string;
      if (!slug) {
        // Fallback if slug is empty (e.g., only special chars)
        const fallbackSlug = 'post-' + Date.now();
        contentPath = `posts/${fallbackSlug}.md`;
      } else {
        contentPath = `posts/${slug}.md`;
      }

      // Create content using hugo new with selected archetype
      console.log('Creating content:', contentPath, 'with archetype:', selectedArchetype);
      const result: CommandOutput = await hugoNewContent(currentProject.path, contentPath, selectedArchetype);
      console.log('hugo new content result:', result);

      // Check for errors - Hugo may return exit_code 0 but still have errors in stderr
      const hasError = result.exit_code !== 0 ||
        (result.stderr && (
          result.stderr.includes('Error') ||
          result.stderr.includes('error') ||
          result.stderr.includes('failed') ||
          result.stderr.includes('theme') ||
          result.stderr.includes('module')
        ));

      if (hasError) {
        const errorMsg = result.stderr || result.stdout || 'Unknown error';
        console.error('hugo new content failed:', errorMsg);

        // Check for theme-related errors
        if (errorMsg.includes('theme') || errorMsg.includes('module') || errorMsg.includes('not found')) {
          alert(t('app.errors.themeRequiredForNewContent',
            '创建文章需要配置主题。请先安装主题，或在 hugo.toml 中移除 theme 配置以使用空白主题。'));
          return;
        }

        // Check for archetype errors - Hugo can still create file with default template
        if (errorMsg.includes('archetype') || errorMsg.includes('archetypes')) {
          console.warn('Archetype not found, but Hugo may have created file with default template');
          // Continue to open file as Hugo usually creates it anyway
        } else if (result.exit_code !== 0) {
          alert(t('app.errors.createPostFailed', { error: errorMsg }));
          return;
        }
      }

      // Wait a moment for file to be created
      await new Promise(resolve => setTimeout(resolve, 200));

      // Try to verify the file was created by reading it directly
      const fullPath = currentProject.path + '\\content\\' + contentPath.replace(/\//g, '\\');
      console.log('Verifying file at:', fullPath);

      try {
        const verifyContent = await readFile(fullPath);
        console.log('File created successfully, content preview:', verifyContent.substring(0, 100));
      } catch (err) {
        console.error('Failed to read created file:', err);
        alert('文章创建后无法读取文件，可能是路径问题');
        return;
      }

      // Refresh file tree first
      if (onRefreshFileTree) {
        await onRefreshFileTree();
      }

      // Then open the file
      if (onOpenFile) {
        onOpenFile(fullPath);
      }

      setIsNewPostDialogOpen(false);
      setNewPostTitle('');

      // Reload file tree
      if (onRefreshFileTree) {
        onRefreshFileTree();
      }
    } catch (err) {
      console.error('Failed to create post:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(t('app.errors.createPostFailed', { error: errorMsg }));
    } finally {
      setIsCreating(false);
    }
  };

  const openPreviewInBrowser = () => {
    if (previewPort) {
      window.open(`http://127.0.0.1:${previewPort}`, '_blank');
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <>
      <header className="h-14 border-b bg-card flex items-center justify-between px-4">
        {/* Left: Logo & Project Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">H</span>
            </div>
            <span className="font-semibold">{t('app.name')}</span>
          </div>
          {currentProject && (
            <>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {currentProject.name}
              </Badge>
              {onCloseProject && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onCloseProject}
                  title={t('header.buttons.closeProject', '关闭项目')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
          {selectedFile && isDirty && (
            <Badge variant="outline" className="text-amber-500 border-amber-500">
              {t('header.badges.modified')}
            </Badge>
          )}
        </div>

        {/* Center: Actions */}
        <TooltipProvider>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewPostDialogOpen(true)}
                  disabled={!currentProject}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('header.buttons.newPost')}
                </Button>
              </TooltipTrigger>
              {!currentProject && (
                <TooltipContent>
                  <p>{t('sidebar.empty.openPrompt')}</p>
                </TooltipContent>
              )}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isPreviewRunning ? 'destructive' : 'default'}
                  size="sm"
                  onClick={onPreview}
                  disabled={!currentProject}
                >
                  {isPreviewRunning ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      {t('header.buttons.stop')}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      {t('header.buttons.preview')}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              {!currentProject && (
                <TooltipContent>
                  <p>{t('sidebar.empty.openPrompt')}</p>
                </TooltipContent>
              )}
            </Tooltip>

            {isPreviewRunning && previewPort && (
              <Button
                variant="ghost"
                size="sm"
                onClick={openPreviewInBrowser}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBuild}
                  disabled={!currentProject}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('header.buttons.build')}
                </Button>
              </TooltipTrigger>
              {!currentProject && (
                <TooltipContent>
                  <p>{t('sidebar.empty.openPrompt')}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Right: Deploy & Language */}
        <TooltipProvider>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Globe className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('common.language.title')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => changeLanguage('zh-CN')}>
                  {t('common.language.zhCN')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                  {t('common.language.en')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDeployConfigOpen(true)}
                  disabled={!currentProject}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('header.tooltip.deployConfig', '部署配置')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onDeploy}
                  disabled={!currentProject}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t('header.buttons.deploy')}
                </Button>
              </TooltipTrigger>
              {!currentProject && (
                <TooltipContent>
                  <p>{t('sidebar.empty.openPrompt')}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </TooltipProvider>
      </header>

      {/* New Post Dialog */}
      <Dialog open={isNewPostDialogOpen} onOpenChange={setIsNewPostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('header.dialog.newPost.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('header.dialog.newPost.titleLabel')}</Label>
              <Input
                id="title"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder={t('header.dialog.newPost.placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="archetype">{t('header.dialog.newPost.archetypeLabel', '内容类型')}</Label>
              <Select
                value={selectedArchetype}
                onValueChange={setSelectedArchetype}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('header.dialog.newPost.selectArchetype', '选择模板')} />
                </SelectTrigger>
                <SelectContent>
                  {availableArchetypes.map((archetype) => (
                    <SelectItem key={archetype} value={archetype}>
                      {archetype}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newPostTitle && (
              <div className="text-sm text-muted-foreground">
                {t('header.dialog.newPost.slug', { slug: generateSlug(newPostTitle) })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewPostDialogOpen(false)}
            >
              {t('header.dialog.newPost.cancel')}
            </Button>
            <Button
              onClick={handleCreatePost}
              disabled={!newPostTitle.trim() || isCreating}
            >
              {isCreating ? t('header.dialog.newPost.creating') : t('header.dialog.newPost.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <DeployConfigDialog open={isDeployConfigOpen} onOpenChange={setIsDeployConfigOpen} />
    </>
  );
}

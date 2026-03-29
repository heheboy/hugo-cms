import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Github, Folder, FileArchive } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/projectStore';
import { installThemeGit, installThemeZip, installThemeFolder } from '@/hooks/useTauri';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

interface InstallThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: () => void;
  defaultTab?: 'git' | 'folder' | 'zip';
}

export function InstallThemeDialog({
  open,
  onOpenChange,
  onInstall,
  defaultTab = 'git',
}: InstallThemeDialogProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const handleTabChange = (value: string) => {
    setActiveTab(value as 'git' | 'folder' | 'zip');
  };
  const [gitUrl, setGitUrl] = useState('');
  const [themeName, setThemeName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [zipPath, setZipPath] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractThemeName = (url: string) => {
    // Extract theme name from git URL
    const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
    if (match) {
      return match[1].replace(/^hugo-theme-/, '').replace(/^hugo-/, '');
    }
    return '';
  };

  const extractFolderName = (path: string) => {
    // Extract theme name from folder path
    const match = path.match(/[/\\]([^/\\]+?)$/);
    if (match) {
      return match[1].replace(/^hugo-theme-/, '').replace(/^hugo-/, '');
    }
    return '';
  };

  const handleGitUrlChange = (url: string) => {
    setGitUrl(url);
    if (!themeName && url) {
      setThemeName(extractThemeName(url));
    }
  };

  const selectFolder = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t('theme.selectFolder', '选择主题文件夹'),
    });
    if (selected && typeof selected === 'string') {
      setFolderPath(selected);
      if (!themeName) {
        setThemeName(extractFolderName(selected));
      }
    }
  };

  const selectZipFile = async () => {
    const selected = await openDialog({
      directory: false,
      multiple: false,
      filters: [
        { name: 'ZIP Files', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      title: t('theme.selectZip', '选择主题 ZIP 文件'),
    });
    if (selected && typeof selected === 'string') {
      setZipPath(selected);
      if (!themeName) {
        // Extract name from zip filename
        const name = selected.replace(/\\/g, '/').split('/').pop() || '';
        setThemeName(name.replace(/\.zip$/i, '').replace(/^hugo-theme-/, '').replace(/^hugo-/, ''));
      }
    }
  };

  const handleInstall = async () => {
    if (!currentProject || !themeName) return;

    try {
      setIsInstalling(true);
      setError(null);

      if (activeTab === 'git') {
        if (!gitUrl) return;
        await installThemeGit(currentProject.path, gitUrl, themeName);
      } else if (activeTab === 'folder') {
        if (!folderPath) return;
        await installThemeFolder(currentProject.path, folderPath, themeName);
      } else if (activeTab === 'zip') {
        if (!zipPath) return;
        await installThemeZip(currentProject.path, zipPath, themeName);
      }

      onInstall();
      onOpenChange(false);
      // Reset form
      setGitUrl('');
      setFolderPath('');
      setZipPath('');
      setThemeName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsInstalling(false);
    }
  };

  const canInstall = () => {
    if (!themeName) return false;
    if (activeTab === 'git' && !gitUrl) return false;
    if (activeTab === 'folder' && !folderPath) return false;
    if (activeTab === 'zip' && !zipPath) return false;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('theme.installTitle')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="git">
              <Github className="h-4 w-4 mr-2" />
              {t('theme.fromGit')}
            </TabsTrigger>
            <TabsTrigger value="folder">
              <Folder className="h-4 w-4 mr-2" />
              {t('theme.fromFolder', '本地文件夹')}
            </TabsTrigger>
            <TabsTrigger value="zip">
              <FileArchive className="h-4 w-4 mr-2" />
              {t('theme.fromZip', 'ZIP 文件')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="git" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="git-url">
                {t('theme.gitUrl')}
              </Label>
              <Input
                id="git-url"
                placeholder="https://github.com/username/hugo-theme-name"
                value={gitUrl}
                onChange={(e) => handleGitUrlChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('theme.gitUrlHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme-name">
                {t('theme.name')}
              </Label>
              <Input
                id="theme-name"
                placeholder="my-theme"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('theme.nameHint')}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="folder" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>
                {t('theme.folderPath', '文件夹路径')}
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  placeholder={t('theme.selectFolderPlaceholder', '选择主题文件夹...')}
                  value={folderPath}
                  className="flex-1"
                />
                <Button variant="outline" onClick={selectFolder}>
                  <Folder className="h-4 w-4 mr-2" />
                  {t('common.actions.browse', '浏览...')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('theme.folderHint', '选择包含主题文件的本地文件夹')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="folder-theme-name">
                {t('theme.name')}
              </Label>
              <Input
                id="folder-theme-name"
                placeholder="my-theme"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('theme.nameHint')}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="zip" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>
                {t('theme.zipFile')}
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  placeholder={t('theme.selectZipPlaceholder', '选择 ZIP 文件...')}
                  value={zipPath}
                  className="flex-1"
                />
                <Button variant="outline" onClick={selectZipFile}>
                  <FileArchive className="h-4 w-4 mr-2" />
                  {t('common.actions.browse', '浏览...')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('theme.zipFileHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip-theme-name">
                {t('theme.name')}
              </Label>
              <Input
                id="zip-theme-name"
                placeholder="my-theme"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('theme.nameHint')}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleInstall}
            disabled={!canInstall() || isInstalling}
          >
            {isInstalling ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t('theme.installing')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('theme.install')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

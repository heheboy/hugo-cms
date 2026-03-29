import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Folder, FileArchive, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/stores/projectStore';
import { open } from '@tauri-apps/plugin-dialog';
import { installThemeGit, installThemeZip } from '@/hooks/useTauri';

interface ThemeInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
  missingTheme: string | null;
  onThemeInstalled: () => void;
  onEditConfig?: () => void;
}

export function ThemeInstallPrompt({
  isOpen,
  onClose,
  missingTheme,
  onThemeInstalled,
  onEditConfig,
}: ThemeInstallPromptProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInstallFromMarket = () => {
    // Close this dialog and let the parent open theme manager
    onClose();
    // Dispatch event to open theme manager
    window.dispatchEvent(new CustomEvent('open-theme-manager', {
      detail: { searchTerm: missingTheme }
    }));
  };

  const handleInstallLocalFolder = async () => {
    if (!currentProject) return;

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Theme Folder',
      });

      if (!selected || typeof selected !== 'string') return;

      setIsInstalling(true);
      setError(null);

      // Install theme from folder
      await installThemeGit(currentProject.path, selected, missingTheme || 'custom-theme');
      onThemeInstalled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsInstalling(false);
    }
  };

  const handleInstallZip = async () => {
    if (!currentProject) return;

    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [
          { name: 'ZIP Files', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        title: 'Select Theme ZIP File',
      });

      if (!selected || typeof selected !== 'string') return;

      setIsInstalling(true);
      setError(null);

      // Install theme from ZIP
      await installThemeZip(currentProject.path, selected, missingTheme || 'custom-theme');
      onThemeInstalled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsInstalling(false);
    }
  };

  const handleEditConfig = () => {
    if (onEditConfig) {
      onEditConfig();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-amber-500" />
            {t('theme.missingTitle', 'Theme Not Installed')}
          </DialogTitle>
          <DialogDescription>
            {missingTheme ? (
              <span>
                {t('theme.missingDescription', 'The theme "{{theme}}" is configured but not found. You need to install it before previewing.', { theme: missingTheme })}
              </span>
            ) : (
              <span>{t('theme.themeRequired', 'A theme is required to preview the site.')}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Install from Market */}
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={handleInstallFromMarket}
            disabled={isInstalling}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">{t('theme.fromMarket', 'Install from Theme Market')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('theme.fromMarketDesc', 'Browse official Hugo themes and install with one click')}
                </div>
              </div>
            </div>
          </Button>

          {/* Install Local Folder */}
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={handleInstallLocalFolder}
            disabled={isInstalling}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Folder className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <div className="font-medium">{t('theme.fromFolder', 'Install from Local Folder')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('theme.fromFolderDesc', 'Select a theme folder from your computer')}
                </div>
              </div>
            </div>
          </Button>

          {/* Install ZIP */}
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4"
            onClick={handleInstallZip}
            disabled={isInstalling}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <FileArchive className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <div className="font-medium">{t('theme.fromZip', 'Install from ZIP File')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('theme.fromZipDesc', 'Select a theme ZIP archive to install')}
                </div>
              </div>
            </div>
          </Button>

          {/* Edit Config */}
          <Button
            variant="ghost"
            className="w-full justify-start h-auto py-3 px-4"
            onClick={handleEditConfig}
            disabled={isInstalling}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <div className="font-medium">{t('theme.editConfig', 'Edit hugo.toml')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('theme.editConfigDesc', 'Manually remove or change theme configuration')}
                </div>
              </div>
            </div>
          </Button>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isInstalling}>
            <X className="h-4 w-4 mr-2" />
            {t('common.actions.cancel', 'Cancel Preview')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

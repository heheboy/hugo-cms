import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Download,
  RefreshCw,
  ExternalLink,
  Palette,
  Search,
  Globe,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/stores/projectStore';
import {
  listThemes,
  setTheme,
  installThemeGit,
  uninstallTheme,
  getOfficialThemes,
  openExternalUrl,
  type ThemeInfo,
  type OfficialTheme,
} from '@/hooks/useTauri';
import { ThemeCard } from './ThemeCard';
import { InstallThemeDialog } from './InstallThemeDialog';

interface ThemeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemeManager({ open, onOpenChange }: ThemeManagerProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState('installed');
  const [installedThemes, setInstalledThemes] = useState<ThemeInfo[]>([]);
  const [officialThemes, setOfficialThemes] = useState<OfficialTheme[]>([]);
  const [customThemes, setCustomThemes] = useState<OfficialTheme[]>([]);
  const [customMarketUrl, setCustomMarketUrl] = useState('');
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOfficialLoading, setIsOfficialLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [installDefaultTab, setInstallDefaultTab] = useState<'git' | 'folder' | 'zip'>('git');
  const [installingTheme, setInstallingTheme] = useState<string | null>(null);

  const loadThemes = useCallback(async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      const themes = await listThemes(currentProject.path);
      setInstalledThemes(themes);

      const active = themes.find((t) => t.is_active);
      if (active) {
        setCurrentTheme(active.name);
      } else {
        setCurrentTheme('');
      }
    } catch (err) {
      console.error('Failed to load themes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  const loadOfficialThemes = useCallback(async () => {
    try {
      setIsOfficialLoading(true);
      const themes = await getOfficialThemes();
      setOfficialThemes(themes);
    } catch (err) {
      console.error('Failed to load official themes:', err);
    } finally {
      setIsOfficialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && currentProject) {
      loadThemes();
      loadOfficialThemes();
    }
  }, [open, currentProject, loadThemes, loadOfficialThemes]);

  const handleActivateTheme = async (themeName: string) => {
    if (!currentProject) return;

    try {
      await setTheme(currentProject.path, themeName);
      setCurrentTheme(themeName);
      await loadThemes();
    } catch (err) {
      console.error('Failed to activate theme:', err);
    }
  };

  const handleUninstallTheme = async (themeName: string) => {
    if (!currentProject) return;

    try {
      await uninstallTheme(currentProject.path, themeName);
      await loadThemes();
    } catch (err) {
      console.error('Failed to uninstall theme:', err);
    }
  };

  const handleInstallFromMarket = async (theme: OfficialTheme) => {
    if (!currentProject) return;

    try {
      setInstallingTheme(theme.name);
      await installThemeGit(currentProject.path, theme.repo, theme.name);
      await loadThemes();
      setActiveTab('installed');
    } catch (err) {
      console.error('Failed to install theme:', err);
    } finally {
      setInstallingTheme(null);
    }
  };

  const loadCustomThemes = async () => {
    if (!customMarketUrl) return;

    // Check if user entered themes.gohugo.io - this doesn't provide a JSON API
    if (customMarketUrl.includes('themes.gohugo.io')) {
      alert(t('theme.officialMarketRedirect', 'themes.gohugo.io 是官方主题市场，请切换到"市场"标签页查看'));
      return;
    }

    try {
      setIsLoadingCustom(true);
      const response = await fetch(customMarketUrl);
      const contentType = response.headers.get('content-type') || '';

      // Handle JSON response
      if (contentType.includes('application/json')) {
        const themes = await response.json();
        const themeList = Array.isArray(themes) ? themes : themes.themes || [];
        setCustomThemes(themeList.map((t: OfficialTheme) => ({
          ...t,
          name: t.name || 'unknown',
          description: t.description || '',
          repo: t.repo || '',
          thumbnail: t.thumbnail || '',
          tags: t.tags || [],
        })));
      } else {
        throw new Error('URL must return JSON format');
      }
    } catch (err) {
      console.error('Failed to load custom themes:', err);
      alert(t('theme.loadCustomFailed', '加载自定义主题失败，请检查URL是否正确'));
    } finally {
      setIsLoadingCustom(false);
    }
  };

  const filteredInstalled = installedThemes.filter((theme) =>
    theme.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOfficial = officialThemes.filter(
    (theme) =>
      theme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      theme.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      theme.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('theme.title')}
            </DialogTitle>
          </DialogHeader>

          {!currentProject ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('theme.noProject')}</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="installed">
                  {t('theme.installed')}
                </TabsTrigger>
                <TabsTrigger value="market">
                  {t('theme.market')}
                </TabsTrigger>
                <TabsTrigger value="custom">
                  <Globe className="h-3 w-3 mr-1" />
                  {t('theme.customMarket', '自定义')}
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 mt-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('theme.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>

              <TabsContent value="installed" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium">
                    {t('theme.installedThemes', { count: installedThemes.length })}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInstallDefaultTab('git');
                        setIsInstallDialogOpen(true);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t('theme.install', '安装')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={loadThemes}
                      disabled={isLoading}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                      />
                    </Button>
                  </div>
                </div>

                {filteredInstalled.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>{t('theme.noThemes')}</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveTab('market')}
                    >
                      {t('theme.browseMarket')}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredInstalled.map((theme) => (
                      <ThemeCard
                        key={theme.name}
                        theme={theme}
                        isActive={theme.name === currentTheme}
                        onActivate={() => handleActivateTheme(theme.name)}
                        onUninstall={() => handleUninstallTheme(theme.name)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="market" className="mt-4">
                <div className="mb-4">
                  <h3 className="text-sm font-medium">
                    {t('theme.officialThemes', { count: officialThemes.length })}
                  </h3>
                </div>

                {isOfficialLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
                    <p className="mt-2 text-muted-foreground">
                      {t('theme.loading')}
                    </p>
                  </div>
                ) : filteredOfficial.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>{t('theme.noSearchResults')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredOfficial.map((theme) => (
                      <div
                        key={theme.name}
                        className="border rounded-lg p-4 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-24 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                            <img
                              src={theme.thumbnail}
                              alt={theme.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{theme.name}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {theme.description}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {theme.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-1.5 py-0.5 bg-secondary rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleInstallFromMarket(theme)}
                            disabled={
                              installingTheme === theme.name ||
                              installedThemes.some((t) => t.name === theme.name)
                            }
                          >
                            {installingTheme === theme.name ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : installedThemes.some(
                                (t) => t.name === theme.name
                              ) ? (
                              <Check className="h-4 w-4 mr-2" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            {installedThemes.some((t) => t.name === theme.name)
                              ? t('theme.installed')
                              : t('theme.install')}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={async () => {
                              try {
                                let url = theme.repo;
                                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                  url = 'https://' + url;
                                }
                                await openExternalUrl(url);
                              } catch (err) {
                                console.error('Failed to open URL:', err);
                                alert(t('theme.openUrlFailed', '无法打开链接'));
                              }
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custom" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={t('theme.customUrlPlaceholder', '输入主题市场 JSON URL')}
                      value={customMarketUrl}
                      onChange={(e) => setCustomMarketUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={loadCustomThemes}
                      disabled={!customMarketUrl || isLoadingCustom}
                    >
                      {isLoadingCustom ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          {t('theme.load', '加载')}
                        </>
                      )}
                    </Button>
                  </div>

                  {customThemes.length > 0 && (
                    <div className="text-sm text-muted-foreground mb-2">
                      {t('theme.customThemes', { count: customThemes.length, defaultValue: `自定义主题 (${customThemes.length})` })}
                    </div>
                  )}

                  {isLoadingCustom ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
                      <p className="mt-2 text-muted-foreground">
                        {t('theme.loading')}
                      </p>
                    </div>
                  ) : customThemes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>{t('theme.noCustomThemes', '输入URL加载自定义主题市场')}</p>
                      <p className="text-xs mt-2">
                        {t('theme.customUrlHint', '支持返回JSON格式的主题列表API')}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {customThemes.map((theme) => (
                        <div
                          key={theme.name}
                          className="border rounded-lg p-4 hover:bg-accent transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-24 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                              <img
                                src={theme.thumbnail}
                                alt={theme.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{theme.name}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {theme.description}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {theme.tags?.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-xs px-1.5 py-0.5 bg-secondary rounded"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleInstallFromMarket(theme)}
                              disabled={
                                installingTheme === theme.name ||
                                installedThemes.some((t) => t.name === theme.name)
                              }
                            >
                              {installingTheme === theme.name ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : installedThemes.some(
                                  (t) => t.name === theme.name
                                ) ? (
                                <Check className="h-4 w-4 mr-2" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              {installedThemes.some((t) => t.name === theme.name)
                                ? t('theme.installed')
                                : t('theme.install')}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={async () => {
                                try {
                                  let url = theme.repo;
                                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                    url = 'https://' + url;
                                  }
                                  await openExternalUrl(url);
                                } catch (err) {
                                  console.error('Failed to open URL:', err);
                                  alert(t('theme.openUrlFailed', '无法打开链接'));
                                }
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <InstallThemeDialog
        open={isInstallDialogOpen}
        onOpenChange={setIsInstallDialogOpen}
        onInstall={loadThemes}
        defaultTab={installDefaultTab}
      />
    </>
  );
}

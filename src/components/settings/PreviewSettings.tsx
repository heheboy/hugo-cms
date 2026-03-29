import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { Label } from '@/components/ui/label';

export function PreviewSettings() {
  const { t } = useTranslation();
  const { settings, updatePreviewSettings } = useSettingsStore();
  const { preview } = settings;

  return (
    <div className="space-y-6">
      {/* Default Port */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="default-port">{t('settings.preview.defaultPort')}</Label>
          <span className="text-sm text-muted-foreground">{preview.defaultPort}</span>
        </div>
        <input
          id="default-port"
          type="range"
          min={1000}
          max={9999}
          step={1}
          value={preview.defaultPort}
          onChange={(e) => updatePreviewSettings({ defaultPort: parseInt(e.target.value) })}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <p className="text-xs text-muted-foreground">
          {t('settings.preview.defaultPortDescription')}
        </p>
      </div>

      {/* Auto Refresh */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="auto-refresh">{t('settings.preview.autoRefresh')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.preview.autoRefreshDescription')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="auto-refresh"
            type="checkbox"
            checked={preview.autoRefresh}
            onChange={(e) => updatePreviewSettings({ autoRefresh: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Open in Browser */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="open-in-browser">{t('settings.preview.openInBrowser')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.preview.openInBrowserDescription')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="open-in-browser"
            type="checkbox"
            checked={preview.openInBrowser}
            onChange={(e) => updatePreviewSettings({ openInBrowser: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>
    </div>
  );
}

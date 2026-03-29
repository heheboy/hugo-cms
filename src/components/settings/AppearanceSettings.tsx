import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { Label } from '@/components/ui/label';
import { Monitor, Sun, Moon } from 'lucide-react';

export function AppearanceSettings() {
  const { t } = useTranslation();
  const { settings, updateAppearanceSettings } = useSettingsStore();
  const { appearance } = settings;

  const themes = [
    { value: 'system', label: t('settings.appearance.themeSystem'), icon: Monitor },
    { value: 'light', label: t('settings.appearance.themeLight'), icon: Sun },
    { value: 'dark', label: t('settings.appearance.themeDark'), icon: Moon },
  ];

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div className="space-y-2">
        <Label>{t('settings.appearance.theme')}</Label>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => updateAppearanceSettings({ theme: value as 'light' | 'dark' | 'system' })}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                appearance.theme === value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sidebar Width */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="sidebar-width">{t('settings.appearance.sidebarWidth')}</Label>
          <span className="text-sm text-muted-foreground">{appearance.sidebarWidth}px</span>
        </div>
        <input
          id="sidebar-width"
          type="range"
          min={200}
          max={400}
          step={10}
          value={appearance.sidebarWidth}
          onChange={(e) => {
            const width = parseInt(e.target.value);
            updateAppearanceSettings({ sidebarWidth: width });
          }}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <p className="text-xs text-muted-foreground">
          {t('settings.appearance.sidebarWidthDescription')}
        </p>
      </div>

      {/* Terminal Height */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="terminal-height">{t('settings.appearance.terminalHeight')}</Label>
          <span className="text-sm text-muted-foreground">{appearance.terminalHeight}px</span>
        </div>
        <input
          id="terminal-height"
          type="range"
          min={150}
          max={500}
          step={10}
          value={appearance.terminalHeight}
          onChange={(e) => updateAppearanceSettings({ terminalHeight: parseInt(e.target.value) })}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <p className="text-xs text-muted-foreground">
          {t('settings.appearance.terminalHeightDescription')}
        </p>
      </div>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { Label } from '@/components/ui/label';

export function EditorSettings() {
  const { t } = useTranslation();
  const { settings, updateEditorSettings } = useSettingsStore();
  const { editor } = settings;

  return (
    <div className="space-y-6">
      {/* Font Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="font-size">{t('settings.editor.fontSize')}</Label>
          <span className="text-sm text-muted-foreground">{editor.fontSize}px</span>
        </div>
        <input
          id="font-size"
          type="range"
          min={10}
          max={24}
          step={1}
          value={editor.fontSize}
          onChange={(e) => updateEditorSettings({ fontSize: parseInt(e.target.value) })}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Tab Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="tab-size">{t('settings.editor.tabSize')}</Label>
          <span className="text-sm text-muted-foreground">{editor.tabSize}</span>
        </div>
        <input
          id="tab-size"
          type="range"
          min={2}
          max={8}
          step={2}
          value={editor.tabSize}
          onChange={(e) => updateEditorSettings({ tabSize: parseInt(e.target.value) })}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Word Wrap */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="word-wrap">{t('settings.editor.wordWrap')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.editor.wordWrapDescription')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="word-wrap"
            type="checkbox"
            checked={editor.wordWrap}
            onChange={(e) => updateEditorSettings({ wordWrap: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Line Numbers */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="line-numbers">{t('settings.editor.lineNumbers')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.editor.lineNumbersDescription')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="line-numbers"
            type="checkbox"
            checked={editor.lineNumbers}
            onChange={(e) => updateEditorSettings({ lineNumbers: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Minimap */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="minimap">{t('settings.editor.minimap')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.editor.minimapDescription')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="minimap"
            type="checkbox"
            checked={editor.minimap}
            onChange={(e) => updateEditorSettings({ minimap: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Insert Spaces */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="insert-spaces">{t('settings.editor.insertSpaces')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.editor.insertSpacesDescription')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="insert-spaces"
            type="checkbox"
            checked={editor.insertSpaces}
            onChange={(e) => updateEditorSettings({ insertSpaces: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>
    </div>
  );
}

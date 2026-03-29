import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, SettingsState } from '@/types';

const defaultSettings: AppSettings = {
  hugoPath: null,  // null means use system PATH
  hugoVersion: null,

  editor: {
    fontSize: 14,
    wordWrap: true,
    lineNumbers: true,
    minimap: false,
    tabSize: 2,
    insertSpaces: true,
  },

  preview: {
    autoRefresh: true,
    defaultPort: 1313,
    openInBrowser: false,
  },

  appearance: {
    theme: 'system',
    sidebarWidth: 256,
    terminalHeight: 256,
  },

  language: 'zh-CN',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      isLoading: false,
      error: null,

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      updateEditorSettings: (partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            editor: { ...state.settings.editor, ...partial },
          },
        })),

      updatePreviewSettings: (partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            preview: { ...state.settings.preview, ...partial },
          },
        })),

      updateAppearanceSettings: (partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            appearance: { ...state.settings.appearance, ...partial },
          },
        })),

      setHugoPath: (path) =>
        set((state) => ({
          settings: { ...state.settings, hugoPath: path },
        })),

      setLanguage: (lang) =>
        set((state) => ({
          settings: { ...state.settings, language: lang },
        })),

      resetSettings: () =>
        set(() => ({
          settings: defaultSettings,
        })),
    }),
    {
      name: 'hugo-cms-settings',
      version: 1, // For future migrations
    }
  )
);

// Helper hook to get effective Hugo path (custom path or system command)
export function useHugoPath(): string {
  const { settings } = useSettingsStore();
  return settings.hugoPath || 'hugo';
}

export interface HugoProject {
  id: string;
  name: string;
  path: string;
  config: HugoConfig;
  lastOpened: Date;
  hugoVersion?: string;
}

export interface HugoConfig {
  title: string;
  baseURL?: string;
  languageCode?: string;
  theme?: string;
  params?: Record<string, unknown>;
  menu?: Record<string, MenuItem[]>;
}

export interface MenuItem {
  name: string;
  url: string;
  weight: number;
}

export interface ContentFile {
  path: string;
  slug: string;
  title: string;
  draft: boolean;
  date?: string;
  frontmatter: Record<string, unknown>;
  body: string;              // 磁盘上的原始内容
  unsavedBody?: string;      // 未保存的修改内容（如果有）
  isDirty?: boolean;         // 是否有未保存的修改
  wordCount: number;
}

export interface FileNode {
  name: string;
  path: string;
  file_type: 'file' | 'directory' | 'error';
  children?: FileNode[];
  isExpanded?: boolean;
  error?: string; // Error message if file_type is "error"
}

export interface CommandOutput {
  stdout: string;
  stderr: string;
  exit_code: number | null;
}

export interface ArchetypeField {
  type: 'string' | 'datetime' | 'boolean' | 'array' | 'image' | 'number';
  required?: boolean;
  default?: unknown;
  items?: string;
  label?: string;
}

export interface Archetype {
  name: string;
  fields: Record<string, ArchetypeField>;
}

// App Settings
export interface AppSettings {
  // Hugo 配置
  hugoPath: string | null;  // Hugo 可执行文件路径，null 表示使用系统 PATH
  hugoVersion: string | null;

  // 编辑器配置
  editor: {
    fontSize: number;
    wordWrap: boolean;
    lineNumbers: boolean;
    minimap: boolean;
    tabSize: number;
    insertSpaces: boolean;
  };

  // 预览配置
  preview: {
    autoRefresh: boolean;
    defaultPort: number;
    openInBrowser: boolean;
  };

  // 外观配置
  appearance: {
    theme: 'light' | 'dark' | 'system';
    sidebarWidth: number;
    terminalHeight: number;
  };

  // 国际化
  language: string;
}

// Hugo Theme
export interface HugoTheme {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  source?: string;  // git url or local path
  isActive: boolean;
  hasScreenshot?: boolean;
}

// Settings Store State
export interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;

  // Actions
  updateSettings: (partial: Partial<AppSettings>) => void;
  updateEditorSettings: (partial: Partial<AppSettings['editor']>) => void;
  updatePreviewSettings: (partial: Partial<AppSettings['preview']>) => void;
  updateAppearanceSettings: (partial: Partial<AppSettings['appearance']>) => void;
  setHugoPath: (path: string | null) => void;
  setLanguage: (lang: string) => void;
  resetSettings: () => void;
}

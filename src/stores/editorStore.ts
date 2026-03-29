import { create } from 'zustand';
import YAML from 'yaml';
import type { ContentFile } from '@/types';

interface EditorState {
  openFiles: ContentFile[];
  activeFilePath: string | null;
  previewMode: 'edit' | 'preview' | 'split';

  // Actions
  openFile: (file: ContentFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  setEditorContent: (content: string) => void;
  setPreviewMode: (mode: 'edit' | 'preview' | 'split') => void;
  saveCurrentFile: () => void;
  saveFile: (path: string) => void;

  // Getters
  getEditorContent: () => string;
  getIsDirty: () => boolean;
  getActiveFile: () => ContentFile | undefined;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  openFiles: [],
  activeFilePath: null,
  previewMode: 'split',

  openFile: (file) => {
    const { openFiles, activeFilePath } = get();
    // Normalize path for consistent comparison
    const normalizedPath = file.path.replace(/\\/g, '/');
    const exists = openFiles.find((f) => f.path === normalizedPath);

    console.log('[openFile] normalizedPath:', normalizedPath);
    console.log('[openFile] exists:', exists ? exists.path : 'not found');
    console.log('[openFile] file.body preview:', file.body?.substring(0, 50));

    if (!exists) {
      // File doesn't exist, add it
      set({ openFiles: [...openFiles, { ...file, path: normalizedPath }] });
    } else {
      // File exists, update metadata but preserve unsaved changes if they exist
      const updatedFiles = openFiles.map((f) =>
        f.path === normalizedPath
          ? {
              ...f,
              body: file.body, // Update to latest disk content
              frontmatter: file.frontmatter,
              title: file.title,
              draft: file.draft,
              date: file.date,
              // Preserve unsaved changes if they exist
              unsavedBody: f.unsavedBody,
              isDirty: f.isDirty,
            }
          : f
      );
      console.log('[openFile] Updated file (preserved unsaved):', exists.unsavedBody ? 'has unsaved' : 'no unsaved');
      set({ openFiles: updatedFiles });
    }

    if (activeFilePath !== normalizedPath) {
      set({
        activeFilePath: normalizedPath,
      });
    }
  },

  closeFile: (path) => {
    const { openFiles, activeFilePath } = get();
    // Normalize path for consistent comparison
    const normalizedPath = path.replace(/\\/g, '/');
    const newOpenFiles = openFiles.filter((f) => f.path !== normalizedPath);

    if (activeFilePath === normalizedPath) {
      const newActiveFile = newOpenFiles[newOpenFiles.length - 1];
      set({
        openFiles: newOpenFiles,
        activeFilePath: newActiveFile?.path || null,
      });
    } else {
      set({ openFiles: newOpenFiles });
    }
  },

  setActiveFile: (path) => {
    const { activeFilePath } = get();
    // Normalize path for consistent comparison
    const normalizedPath = path.replace(/\\/g, '/');

    // If clicking on already active file, do nothing
    if (activeFilePath === normalizedPath) {
      return;
    }

    set({ activeFilePath: normalizedPath });
  },

  setEditorContent: (content) => {
    const { activeFilePath, openFiles } = get();
    if (!activeFilePath) return;

    // Update the current file's unsavedBody and isDirty
    const updatedFiles = openFiles.map((f) =>
      f.path === activeFilePath
        ? { ...f, unsavedBody: content, isDirty: true }
        : f
    );

    set({ openFiles: updatedFiles });
  },

  setPreviewMode: (mode) => set({ previewMode: mode }),

  saveCurrentFile: () => {
    const { activeFilePath } = get();
    if (!activeFilePath) return;
    get().saveFile(activeFilePath);
  },

  saveFile: (path: string) => {
    const { openFiles } = get();
    const targetFile = openFiles.find((f) => f.path === path);
    if (!targetFile || !targetFile.unsavedBody) return;

    // Parse frontmatter from the full content for metadata update
    const frontmatterMatch = targetFile.unsavedBody.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

    let frontmatter: Record<string, unknown> = {};
    let bodyOnly = targetFile.unsavedBody;

    if (frontmatterMatch) {
      const frontmatterContent = frontmatterMatch[1];
      bodyOnly = frontmatterMatch[2] || '';

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

    // Save: update body with unsavedBody, clear unsavedBody and isDirty
    const updatedFiles = openFiles.map((f) =>
      f.path === path
        ? {
            ...f,
            body: targetFile.unsavedBody || f.body,
            unsavedBody: undefined,
            isDirty: false,
            frontmatter,
            title: (frontmatter.title as string) || f.title,
            draft: frontmatter.draft === true || frontmatter.draft === 'true',
            date: frontmatter.date as string,
            wordCount: bodyOnly.split(/\s+/).length,
          }
        : f
    );

    set({ openFiles: updatedFiles });
  },

  // Getter functions to access current editor content and dirty state
  getEditorContent: () => {
    const { openFiles, activeFilePath } = get();
    if (!activeFilePath) return '';
    const file = openFiles.find((f) => f.path === activeFilePath);
    console.log('[getEditorContent] activeFilePath:', activeFilePath);
    console.log('[getEditorContent] found file:', file ? file.path : 'not found');
    console.log('[getEditorContent] unsavedBody:', file?.unsavedBody ? 'exists' : 'null');
    console.log('[getEditorContent] body preview:', file?.body?.substring(0, 50));
    // Return unsavedBody if exists (which should contain full content including frontmatter)
    // Otherwise return body (disk content with frontmatter)
    return file?.unsavedBody ?? file?.body ?? '';
  },

  getIsDirty: () => {
    const { openFiles, activeFilePath } = get();
    if (!activeFilePath) return false;
    const file = openFiles.find((f) => f.path === activeFilePath);
    return file?.isDirty ?? false;
  },

  getActiveFile: () => {
    const { openFiles, activeFilePath } = get();
    if (!activeFilePath) return undefined;
    return openFiles.find((f) => f.path === activeFilePath);
  },
}));

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, Eye, Columns, FileText } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { writeFile, loadDeployConfig } from '@/hooks/useTauri';
import MonacoEditor from '@monaco-editor/react';
import { MarkdownToolbar } from './MarkdownToolbar';
import { MediaBrowser } from '@/components/media/MediaBrowser';
import { MarkdownPreview } from './MarkdownPreview';

interface EditorProps {
  // previewPort removed - now using external window
}

export function Editor() {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [editorValue, setEditorValue] = useState('');
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isAttachmentPickerOpen, setIsAttachmentPickerOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [fileToClose, setFileToClose] = useState<string | null>(null);
  const [deployPathPrefix, setDeployPathPrefix] = useState<string>('');
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    openFiles,
    activeFilePath,
    previewMode,
    setEditorContent,
    setActiveFile,
    closeFile,
    getEditorContent,
    getIsDirty,
    getActiveFile,
    saveFile,
  } = useEditorStore();
  const { currentProject } = useProjectStore();
  const { settings } = useSettingsStore();
  const { editor: editorSettings } = settings;

  // Load deploy config to get path prefix
  useEffect(() => {
    if (currentProject?.path) {
      loadDeployConfig(currentProject.path).then((config) => {
        if (config?.path_prefix) {
          setDeployPathPrefix(config.path_prefix);
        }
      }).catch(() => {
        // Ignore error if no deploy config exists
      });
    }
  }, [currentProject?.path]);

  // Update editor value when file changes
  useEffect(() => {
    const content = getEditorContent();
    setEditorValue(content);
  }, [activeFilePath, openFiles, getEditorContent]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditorValue(value);
      setEditorContent(value);
    }
  }, [setEditorContent]);

  const handleSave = useCallback(async () => {
    console.log('=== handleSave called ===');
    console.log('activeFilePath:', activeFilePath);
    console.log('currentProject:', currentProject?.path);

    if (!activeFilePath || !currentProject) {
      console.log('Save aborted: missing activeFilePath or currentProject');
      return;
    }

    const activeFile = getActiveFile();
    if (!activeFile || !activeFile.unsavedBody) {
      console.log('Save aborted: no unsaved content');
      return;
    }

    try {
      setIsSaving(true);
      const content = activeFile.unsavedBody;

      console.log('Saving file:', activeFilePath);
      console.log('Content length:', content?.length);

      // Save the full content as-is (editor now shows complete file with frontmatter)
      await writeFile(activeFilePath, content);

      console.log('File saved successfully');
      // Update store
      useEditorStore.getState().saveCurrentFile();
      console.log('Store updated');
    } catch (err) {
      console.error('Failed to save file:', err);
      alert(t('editor.alerts.saveFailed', { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setIsSaving(false);
    }
  }, [activeFilePath, currentProject, getActiveFile]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Handle window resize for Monaco Editor
  useEffect(() => {
    // Simplified resize handling - only trigger on specific events, not continuously
    // Monaco's automaticLayout handles most cases, we only assist with fullscreen/window state changes

    let resizeTimeout: NodeJS.Timeout | null = null;

    const debouncedLayoutUpdate = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        // Force a layout update when window state changes
        if (editorRef.current) {
          editorRef.current.layout();
          console.log('[Editor] Layout updated on window change');
        }
      }, 100);
    };

    // Listen to fullscreen changes
    const handleFullscreenChange = () => {
      console.log('[Editor] Fullscreen change detected');
      debouncedLayoutUpdate();
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Listen to visibility changes (window restore from minimized)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        debouncedLayoutUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, []);

  // Force layout update when preview mode changes
  useEffect(() => {
    // Monaco's automaticLayout will handle the resize
    // This effect is mainly for logging/debugging
    console.log('[Editor] Preview mode changed:', previewMode);
  }, [previewMode]);

  const handleTabClick = (path: string) => {
    setActiveFile(path);
  };

  const handleCloseTab = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation();

    // Check if file has unsaved changes
    const file = openFiles.find((f) => f.path === path);
    if (file?.isDirty) {
      // Show confirmation dialog
      setFileToClose(path);
      setIsCloseConfirmOpen(true);
    } else {
      // No unsaved changes, close directly
      closeFile(path);
    }
  }, [openFiles, closeFile]);

  const handleConfirmClose = async (shouldSave: boolean) => {
    if (!fileToClose) return;

    if (shouldSave) {
      // Get the file to close
      const fileToSave = openFiles.find((f) => f.path === fileToClose);
      if (fileToSave?.unsavedBody && currentProject) {
        try {
          setIsSaving(true);
          // Save the specific file to disk
          await writeFile(fileToClose, fileToSave.unsavedBody);
          // Update store state for that file
          saveFile(fileToClose);
        } catch (err) {
          console.error('Failed to save file:', err);
          alert(t('editor.alerts.saveFailed', { error: err instanceof Error ? err.message : String(err) }));
          setIsSaving(false);
          return; // Don't close if save failed
        } finally {
          setIsSaving(false);
        }
      }
    }

    // Close the file
    closeFile(fileToClose);
    setIsCloseConfirmOpen(false);
    setFileToClose(null);
  };

  const handleCancelClose = () => {
    setIsCloseConfirmOpen(false);
    setFileToClose(null);
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    // Monaco's automaticLayout handles resize automatically
    // Just log for debugging
    console.log('[Editor] Monaco editor mounted');
  };

  const handleInsertImage = (imagePath: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Convert absolute path to relative path for markdown
    // Use path with deploy prefix if available (/blog/images/xxx.jpg)
    // This ensures images work correctly with GitHub Pages subdirectories
    const relativePath = imagePath.replace(/\\/g, '/').replace(/^.*?static/, '');
    const fullPath = deployPathPrefix ? `${deployPathPrefix}${relativePath}` : relativePath;
    const imageMarkdown = `![图片](${fullPath})`;

    const position = editor.getPosition();
    if (position) {
      editor.executeEdits('image-picker', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          text: imageMarkdown,
        },
      ]);
    }

    setIsImagePickerOpen(false);
    editor.focus();
  };

  const handleInsertAttachment = (attachmentPath: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Convert absolute path to relative path for markdown
    // Use path with deploy prefix if available (/blog/attachments/xxx.pdf)
    // This ensures attachments work correctly with GitHub Pages subdirectories
    const relativePath = attachmentPath.replace(/\\/g, '/').replace(/^.*?static/, '');
    const fileName = relativePath.split('/').pop() || '附件';
    const fullPath = deployPathPrefix ? `${deployPathPrefix}${relativePath}` : relativePath;
    const attachmentMarkdown = `[${fileName}](${fullPath})`;

    const position = editor.getPosition();
    if (position) {
      editor.executeEdits('attachment-picker', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          text: attachmentMarkdown,
        },
      ]);
    }

    setIsAttachmentPickerOpen(false);
    editor.focus();
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground bg-background">
        <div className="text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">{t('editor.empty.noProject')}</p>
          <p className="text-sm">{t('editor.empty.openPrompt')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background">
      {/* Tabs */}
      {openFiles.length > 0 && (
        <div className="flex border-b bg-muted/50">
          <div className="flex overflow-x-auto">
            {openFiles.map((file) => {
              // Extract filename from path
              const fileName = file.path.split(/[/\\]/).pop() || file.title || file.slug;
              return (
                <TooltipProvider key={file.path}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleTabClick(file.path)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm border-r border-border hover:bg-muted transition-colors ${
                          activeFilePath === file.path
                            ? 'bg-background text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <span className="truncate max-w-[150px]">{fileName}</span>
                        {activeFilePath === file.path && file.isDirty && (
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                        )}
                        <span
                          className="ml-1 hover:text-destructive cursor-pointer"
                          onClick={(e) => handleCloseTab(e, file.path)}
                        >
                          ×
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{file.path}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <Tabs
          value={previewMode}
          onValueChange={(v) =>
            useEditorStore.getState().setPreviewMode(v as 'edit' | 'preview' | 'split')
          }
        >
          <TabsList>
            <TabsTrigger value="edit" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {t('editor.modes.edit')}
            </TabsTrigger>
            <TabsTrigger value="split" className="flex items-center gap-1">
              <Columns className="h-3 w-3" />
              {t('editor.modes.split')}
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {t('editor.modes.preview')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {getIsDirty() && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {t('editor.buttons.save')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('editor.tooltip.save')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden" style={{ width: '100%' }}>
        {(previewMode === 'edit' || previewMode === 'split') && (
          <div className={`${previewMode === 'split' ? 'w-1/2' : 'w-full'} border-r flex flex-col overflow-hidden`} style={{ maxWidth: previewMode === 'split' ? '50%' : '100%' }}>
            {/* Markdown Toolbar */}
            {activeFilePath?.endsWith('.md') && (
              <MarkdownToolbar
                editorRef={editorRef}
                onInsertImage={() => setIsImagePickerOpen(true)}
                onInsertAttachment={() => setIsAttachmentPickerOpen(true)}
              />
            )}
            <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ width: '100%', minWidth: 0, position: 'relative' }}>
              <MonacoEditor
                key={`${activeFilePath || 'empty'}-${previewMode}`}
                height="100%"
                width="100%"
                defaultLanguage="markdown"
                theme="vs-dark"
                value={editorValue}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: editorSettings.minimap },
                  lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
                  wordWrap: activeFilePath?.endsWith('.html') || activeFilePath?.endsWith('.css') || activeFilePath?.endsWith('.js') ? 'on' : (editorSettings.wordWrap ? 'on' : 'off'),
                  fontSize: editorSettings.fontSize,
                  tabSize: editorSettings.tabSize,
                  insertSpaces: editorSettings.insertSpaces,
                  fontFamily: 'JetBrains Mono, Fira Code, monospace',
                  scrollBeyondLastLine: false,
                  renderWhitespace: 'selection',
                  automaticLayout: true, // Re-enable automatic layout - Monaco handles it better
                  fixedOverflowWidgets: true, // Prevent overflow widgets from expanding width
                  maxTokenizationLineLength: 10000, // Prevent long lines from causing issues
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                }}
              />
            </div>
          </div>
        )}
        {(previewMode === 'preview' || previewMode === 'split') && (
          <div
            className={`${previewMode === 'split' ? 'w-1/2' : 'w-full'} bg-white overflow-hidden`}
            style={{ maxWidth: previewMode === 'split' ? '50%' : '100%' }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {previewMode === 'split' ? (
              // Split mode: show real-time markdown preview
              <MarkdownPreview content={editorValue} projectPath={currentProject?.path} />
            ) : (
              // Preview mode: show hint to open external preview window
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t('editor.empty.previewInWindow', '请点击上方"打开预览窗口"按钮')}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attachment Picker Dialog */}
      <Dialog open={isAttachmentPickerOpen} onOpenChange={setIsAttachmentPickerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('editor.insertAttachment', '插入附件')}</DialogTitle>
          </DialogHeader>
          <div className="h-[500px]">
            <MediaBrowser
              onSelectFile={handleInsertAttachment}
              selectMode={true}
              subdirectory="attachments"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Picker Dialog */}
      <Dialog open={isImagePickerOpen} onOpenChange={setIsImagePickerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('editor.insertImage', '插入图片')}</DialogTitle>
          </DialogHeader>
          <div className="h-[500px]">
            <MediaBrowser
              onSelectImage={handleInsertImage}
              selectMode={true}
            />
          </div>
        </DialogContent>
      </Dialog>
      {/* Close Confirmation Dialog */}
      <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editor.unsavedChangesTitle', '未保存的修改')}</DialogTitle>
            <DialogDescription>
              {t('editor.unsavedChangesDescription', '文件有未保存的修改，是否保存？')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelClose}>
              {t('common.actions.cancel', '取消')}
            </Button>
            <Button variant="secondary" onClick={() => handleConfirmClose(false)}>
              {t('editor.dontSave', '不保存')}
            </Button>
            <Button onClick={() => handleConfirmClose(true)}>
              {t('editor.saveAndClose', '保存并关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Editor;

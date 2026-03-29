import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Folder,
  FileImage,
  File,
  RefreshCw,
  Upload,
  Plus,
  ChevronLeft,
  Image as ImageIcon,
  Paperclip,
  FolderRoot,
  Eye,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/stores/projectStore';
import {
  listMediaFiles,
  deleteMediaFile,
  deleteMediaDirectory,
  renameMediaItem,
  createMediaDirectory,
  readImageBase64,
  type MediaFile,
  type MediaDirectory,
} from '@/hooks/useTauri';
import { ImageThumbnail } from './ImageThumbnail';
import { UploadDropzone } from './UploadDropzone';

interface MediaBrowserProps {
  onSelectImage?: (path: string) => void;
  selectMode?: boolean;
  subdirectory?: string;
  fileFilter?: 'all' | 'images' | 'attachments';
  onSelectFile?: (path: string) => void;
}

export function MediaBrowser({ onSelectImage, selectMode, subdirectory, fileFilter = 'all', onSelectFile }: MediaBrowserProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [directory, setDirectory] = useState<MediaDirectory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | undefined>(subdirectory);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const isCancelledRef = useRef(false);
  const [_contextMenuFile, _setContextMenuFile] = useState<MediaFile | null>(null);
  const [contextMenuFolder, setContextMenuFolder] = useState<string | null>(null);
  // Image preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImagePath, setPreviewImagePath] = useState<string>('');
  const [previewImageName, setPreviewImageName] = useState<string>('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const loadMedia = useCallback(async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      isCancelledRef.current = false;
      const result = await listMediaFiles(currentProject.path, currentPath);
      if (!isCancelledRef.current) {
        setDirectory(result);
      }
    } catch (err) {
      if (!isCancelledRef.current) {
        console.error('Failed to load media:', err);
      }
    } finally {
      if (!isCancelledRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentProject, currentPath]);

  useEffect(() => {
    loadMedia();

    return () => {
      isCancelledRef.current = true;
    };
  }, [loadMedia]);

  const handleDelete = async () => {
    try {
      if (selectedFile) {
        await deleteMediaFile(selectedFile.path);
      } else if (contextMenuFolder && currentProject) {
        // Delete folder
        const folderPath = currentPath
          ? `${currentProject.path}/static/${currentPath}/${contextMenuFolder}`
          : `${currentProject.path}/static/${contextMenuFolder}`;
        await deleteMediaDirectory(folderPath);
      }
      await loadMedia();
      setIsDeleteDialogOpen(false);
      setSelectedFile(null);
      setContextMenuFolder(null);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;

    try {
      if (selectedFile) {
        // Rename file
        await renameMediaItem(selectedFile.path, renameValue.trim());
      } else if (contextMenuFolder && currentProject) {
        // Rename folder - construct full path
        const oldPath = currentPath
          ? `${currentProject.path}/static/${currentPath}/${contextMenuFolder}`
          : `${currentProject.path}/static/${contextMenuFolder}`;
        await renameMediaItem(oldPath, renameValue.trim());
      }
      await loadMedia();
      setIsRenameDialogOpen(false);
      setSelectedFile(null);
      setContextMenuFolder(null);
      setRenameValue('');
    } catch (err) {
      console.error('Failed to rename:', err);
    }
  };

  // Image preview handlers
  const handleOpenPreview = async (file: MediaFile) => {
    if (!file.is_image) return;
    setPreviewImagePath(file.path);
    setPreviewImageName(file.name);
    setIsPreviewLoading(true);
    setIsPreviewOpen(true);

    try {
      const base64Url = await readImageBase64(file.path);
      setPreviewImageUrl(base64Url);
    } catch (err) {
      console.error('Failed to load image preview:', err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setPreviewImagePath('');
    setPreviewImageName('');
    setPreviewImageUrl('');
  };

  const handleCreateFolder = async () => {
    if (!currentProject || !newFolderName.trim()) return;

    try {
      const fullPath = currentPath
        ? `${currentPath}/${newFolderName.trim()}`
        : newFolderName.trim();
      await createMediaDirectory(currentProject.path, fullPath);
      await loadMedia();
      setIsCreateFolderOpen(false);
      setNewFolderName('');
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath
      ? `${currentPath}/${folderName}`
      : folderName;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.length > 0 ? parts.join('/') : undefined);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const copyFilePath = (file: MediaFile) => {
    const relativePath = file.path.replace(/\\/g, '/').replace(/^.*?static\//, '/');
    copyToClipboard(relativePath);
  };

  const copyMarkdownImage = (file: MediaFile) => {
    const relativePath = file.path.replace(/\\/g, '/').replace(/^.*?static\//, '/');
    copyToClipboard(`![${file.name}](${relativePath})`);
  };

  const copyFolderPath = (folderName: string) => {
    const relativePath = currentPath ? `/${currentPath}/${folderName}/` : `/${folderName}/`;
    copyToClipboard(relativePath);
  };

  if (!currentProject) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{t('media.noProject')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col p-3 border-b gap-2">
        {/* Row 1: Navigation + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={navigateUp}
              disabled={!currentPath}
              title={t('media.back', '返回上一层')}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium truncate">
              {currentPath || 'static'}
            </span>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUploadOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              {t('media.upload')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateFolderOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('media.newFolder')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadMedia}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {/* Row 2: Quick navigation buttons */}
        <div className="flex items-center gap-1 pl-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs whitespace-nowrap"
            onClick={() => setCurrentPath(undefined)}
            disabled={!currentPath}
            title={t('media.root', '根目录')}
          >
            <FolderRoot className="h-3.5 w-3.5 mr-1" />
            {t('media.rootShort', '根')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs whitespace-nowrap"
            onClick={() => setCurrentPath('images')}
            disabled={currentPath === 'images'}
            title={t('media.imagesFolder', '图片')}
          >
            <ImageIcon className="h-3.5 w-3.5 mr-1" />
            {t('media.imagesShort', '图片')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs whitespace-nowrap"
            onClick={() => setCurrentPath('attachments')}
            disabled={currentPath === 'attachments'}
            title={t('media.attachmentsFolder', '附件')}
          >
            <Paperclip className="h-3.5 w-3.5 mr-1" />
            {t('media.attachmentsShort', '附件')}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Subdirectories */}
          {directory && directory.subdirectories.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                {t('media.folders')}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {directory.subdirectories.map((folder, index) => (
                  <ContextMenu key={`folder-${folder}-${index}`}>
                    <ContextMenuTrigger asChild>
                      <div
                        key={`folder-div-${folder}-${index}`}
                        onClick={() => navigateToFolder(folder)}
                        className="flex flex-col items-center p-3 rounded-lg hover:bg-accent transition-colors cursor-context-menu"
                      >
                        <Folder className="h-10 w-10 text-blue-500 mb-1" />
                        <span className="text-xs truncate w-full text-center">
                          {folder}
                        </span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => navigateToFolder(folder)}>
                        {t('media.open', '打开')}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => copyFolderPath(folder)}>
                        {t('media.copyPath', '复制路径')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => {
                        setContextMenuFolder(folder);
                        setRenameValue(folder);
                        setIsRenameDialogOpen(true);
                      }}>
                        {t('media.rename')}
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setContextMenuFolder(folder);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        {t('media.delete')}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {directory && directory.files.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                {t('media.files')}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {directory.files.map((file, index) => (
                  <ContextMenu key={`${file.path}-${index}`}>
                    <ContextMenuTrigger asChild>
                      <div
                        key={`file-${file.path}-${index}`}
                        className="group relative flex flex-col items-center p-3 rounded-lg hover:bg-accent transition-colors cursor-context-menu"
                        onClick={() => {
                          if (selectMode && file.is_image && onSelectImage) {
                            onSelectImage(file.path);
                          } else if (selectMode && onSelectFile) {
                            onSelectFile(file.path);
                          }
                        }}
                        onDoubleClick={() => {
                          if (file.is_image) {
                            handleOpenPreview(file);
                          }
                        }}
                      >
                        {file.is_image ? (
                          <div className="w-full aspect-square mb-1">
                            <ImageThumbnail path={file.path} name={file.name} />
                          </div>
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center mb-1">
                            <File className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-xs truncate w-full text-center">
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      {file.is_image && (
                        <ContextMenuItem onClick={() => handleOpenPreview(file)}>
                          <Eye className="h-4 w-4 mr-2" />
                          {t('media.preview', '预览')}
                        </ContextMenuItem>
                      )}
                      {selectMode && file.is_image && onSelectImage && (
                        <ContextMenuItem onClick={() => onSelectImage(file.path)}>
                          {t('media.selectImage', '选择此图片')}
                        </ContextMenuItem>
                      )}
                      {selectMode && !file.is_image && onSelectFile && (
                        <ContextMenuItem onClick={() => onSelectFile(file.path)}>
                          {t('media.selectFile', '选择此文件')}
                        </ContextMenuItem>
                      )}
                      {file.is_image && (
                        <ContextMenuItem onClick={() => copyMarkdownImage(file)}>
                          {t('media.copyMarkdown', '复制 Markdown')}
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem onClick={() => copyFilePath(file)}>
                        {t('media.copyPath', '复制路径')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => {
                        setSelectedFile(file);
                        setRenameValue(file.name);
                        setIsRenameDialogOpen(true);
                      }}>
                        {t('media.rename')}
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setSelectedFile(file);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        {t('media.delete')}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </div>
          ) : directory?.subdirectories.length === 0 && directory?.files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileImage className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('media.empty', '暂无文件')}</p>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('media.uploadTitle')}</DialogTitle>
            <DialogDescription>{t('media.uploadDescription')}</DialogDescription>
          </DialogHeader>
          <UploadDropzone
            projectPath={currentProject?.path}
            subdirectory={currentPath}
            uploadType={currentPath?.startsWith('images') ? 'images' : currentPath?.startsWith('attachments') ? 'attachments' : 'any'}
            onSuccess={() => {
              loadMedia();
              setIsUploadOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('media.createFolderTitle')}</DialogTitle>
            <DialogDescription>{t('media.createFolderDescription')}</DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t('media.folderNamePlaceholder')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              {t('common.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        setIsDeleteDialogOpen(open);
        if (!open) {
          setSelectedFile(null);
          setContextMenuFolder(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedFile ? t('media.deleteConfirmTitle') : contextMenuFolder ? t('media.deleteFolderTitle') : t('media.deleteConfirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedFile
                ? t('media.deleteConfirmDescription', { name: selectedFile?.name })
                : contextMenuFolder
                ? t('media.deleteFolderDescription', { name: contextMenuFolder })
                : t('media.deleteConfirmDescription', { name: '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeleteDialogOpen(false);
              setSelectedFile(null);
              setContextMenuFolder(null);
            }}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('media.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedFile ? t('media.renameTitle') : t('media.renameFolderTitle', '重命名文件夹')}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={t('media.renamePlaceholder')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsRenameDialogOpen(false);
              setSelectedFile(null);
              setContextMenuFolder(null);
              setRenameValue('');
            }}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>
              {t('media.rename')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-none">
          <DialogHeader className="absolute top-2 right-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleClosePreview}
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[300px] max-h-[85vh]">
            {isPreviewLoading ? (
              <div className="text-white text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>{t('media.loading', '加载中...')}</p>
              </div>
            ) : previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt={previewImageName}
                className="max-w-full max-h-[85vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="text-white text-center">
                <p>{t('media.loadFailed', '加载失败')}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

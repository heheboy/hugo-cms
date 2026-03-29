import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileImage, Check, X, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { uploadMediaFiles } from '@/hooks/useTauri';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

interface UploadDropzoneProps {
  projectPath: string;
  subdirectory?: string;
  onSuccess?: () => void;
  uploadType?: 'images' | 'attachments' | 'any';
}

interface SelectedFile {
  name: string;
  path: string;
  size: number;
  content?: Uint8Array;
}

// File type configurations
const fileTypeConfigs = {
  images: {
    label: '图片',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'],
    accept: 'image/*',
    icon: FileImage,
    description: '支持 PNG, JPG, GIF, WebP, SVG 等图片格式',
  },
  attachments: {
    label: '附件',
    extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z', 'txt', 'md', 'json', 'csv', 'mp4', 'mp3', 'wav'],
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.md,.json,.csv,.mp4,.mp3,.wav',
    icon: File,
    description: '支持文档、压缩包、音视频等常用格式',
  },
  any: {
    label: '文件',
    extensions: ['*'],
    accept: '*/*',
    icon: File,
    description: '支持所有文件格式',
  },
};

// Sanitize filename: remove special characters and spaces
function sanitizeFileName(name: string): string {
  // Get extension
  const lastDot = name.lastIndexOf('.');
  const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;
  const extension = lastDot > 0 ? name.slice(lastDot) : '';

  // Replace special characters with underscore
  let sanitized = baseName
    .replace(/\s+/g, '_')           // Spaces to underscore
    .replace(/[()\[\]{}]/g, '_')    // Brackets to underscore
    .replace(/['"`]/g, '')          // Remove quotes
    .replace(/[!@#$%^&*+|=;:?/\\<>]/g, '_')  // Special chars to underscore
    .replace(/_+/g, '_')            // Multiple underscores to single
    .replace(/^_+|_+$/g, '');       // Remove leading/trailing underscores

  // Handle empty name
  if (!sanitized) {
    sanitized = 'file';
  }

  return sanitized + extension;
}

export function UploadDropzone({ projectPath, subdirectory, onSuccess, uploadType = 'any' }: UploadDropzoneProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const config = fileTypeConfigs[uploadType];
  const IconComponent = config.icon;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addWebFiles(files);
  }, []);

  // Handle web File objects from drag and drop
  const addWebFiles = async (files: File[]) => {
    const newFiles: SelectedFile[] = [];

    for (const file of files) {
      try {
        // Read file content using FileReader
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Sanitize filename
        const sanitizedName = sanitizeFileName(file.name);

        newFiles.push({
          name: sanitizedName,
          path: sanitizedName,
          size: file.size,
          content: uint8Array,
        });
      } catch (err) {
        console.error(`Failed to read file ${file.name}:`, err);
      }
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  // Handle files selected via Tauri dialog
  const handleSelectFiles = async () => {
    try {
      const filters = uploadType === 'images'
        ? [
            {
              name: 'Images',
              extensions: fileTypeConfigs.images.extensions,
            },
            {
              name: 'All Files',
              extensions: ['*'],
            },
          ]
        : uploadType === 'attachments'
        ? [
            {
              name: 'Documents',
              extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'],
            },
            {
              name: 'Archives',
              extensions: ['zip', 'rar', '7z'],
            },
            {
              name: 'Media',
              extensions: ['mp4', 'mp3', 'wav'],
            },
            {
              name: 'All Files',
              extensions: ['*'],
            },
          ]
        : [
            {
              name: 'Images',
              extensions: fileTypeConfigs.images.extensions,
            },
            {
              name: 'All Files',
              extensions: ['*'],
            },
          ];

      const selected = await open({
        multiple: true,
        filters,
      });

      if (selected && Array.isArray(selected)) {
        const newFiles: SelectedFile[] = [];

        for (const filePath of selected) {
          try {
            // Read file using Tauri FS API
            const content = await readFile(filePath);
            const originalName = filePath.split(/[/\\]/).pop() || 'unknown';

            // Sanitize filename
            const sanitizedName = sanitizeFileName(originalName);

            newFiles.push({
              name: sanitizedName,
              path: filePath,
              size: content.length,
              content,
            });
          } catch (err) {
            console.error(`Failed to read file ${filePath}:`, err);
          }
        }

        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.error('Failed to select files:', err);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    const uploaded: string[] = [];

    try {
      // Convert files to base64 and upload
      const filesToUpload: { name: string; content: string }[] = [];

      for (const file of selectedFiles) {
        if (!file.content) continue;

        try {
          // Convert Uint8Array to base64
          const base64 = btoa(
            file.content.reduce((data, byte) => data + String.fromCharCode(byte), '')
          );

          filesToUpload.push({
            name: file.name,
            content: base64,
          });
        } catch (err) {
          console.error(`Failed to process file ${file.name}:`, err);
        }
      }

      // Upload files
      if (filesToUpload.length > 0) {
        await uploadMediaFiles(projectPath, subdirectory, filesToUpload);
        uploaded.push(...filesToUpload.map(f => f.name));
      }

      setUploadedFiles(uploaded);

      if (uploaded.length > 0 && onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setUploadedFiles([]);
  };

  return (
    <div className="space-y-4">
      {/* Upload Type Info */}
      <div className="text-sm text-muted-foreground text-center">
        <span className="inline-flex items-center gap-1">
          <IconComponent className="h-4 w-4" />
          {t('media.uploadTarget', '上传到')}: <strong>{config.label}</strong>
        </span>
        <p className="text-xs mt-1">{config.description}</p>
      </div>

      {/* Dropzone */}
      {!isUploading && uploadedFiles.length === 0 && (
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <IconComponent className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">{t('media.dropzoneText')}</p>
          <p className="text-xs text-muted-foreground mb-4">
            {config.description}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={handleSelectFiles}>
              {t('media.selectFiles')}
            </Button>
          </div>
        </div>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && uploadedFiles.length === 0 && !isUploading && (
        <div className="border rounded-lg">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-medium">
              {t('media.selectedFiles', { count: selectedFiles.length })}
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4 mr-1" />
              {t('media.clear')}
            </Button>
          </div>
          <ScrollArea className="h-[150px]">
            <div className="p-2 space-y-1">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded hover:bg-accent"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 border-t">
            <Button onClick={handleUpload} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              {t('media.upload')}
            </Button>
          </div>
        </div>
      )}

      {/* Uploading State */}
      {isUploading && (
        <div className="text-center py-8">
          <Upload className="h-10 w-10 mx-auto mb-2 animate-bounce text-primary" />
          <p className="text-muted-foreground">{t('media.uploading')}</p>
        </div>
      )}

      {/* Success State */}
      {uploadedFiles.length > 0 && (
        <div className="text-center py-8">
          <Check className="h-10 w-10 mx-auto mb-2 text-green-500" />
          <p className="text-muted-foreground">
            {t('media.uploadSuccess', { count: uploadedFiles.length })}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onSuccess}>
            {t('common.actions.close')}
          </Button>
        </div>
      )}
    </div>
  );
}

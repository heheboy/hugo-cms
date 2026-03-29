import { useState, useEffect } from 'react';
import { getImageInfo, readImageBase64, type ImageInfo } from '@/hooks/useTauri';

interface ImageThumbnailProps {
  path: string;
  name: string;
  className?: string;
}

export function ImageThumbnail({ path, name, className }: ImageThumbnailProps) {
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        // Load image info
        const info = await getImageInfo(path);
        setImageInfo(info);

        // Load image as base64
        const base64Url = await readImageBase64(path);
        setImageUrl(base64Url);
      } catch (err) {
        console.error('Failed to load image:', err);
        setError(true);
      }
    };

    loadImage();
  }, [path]);

  return (
    <div className={`relative overflow-hidden rounded ${className}`}>
      {error || !imageUrl ? (
        <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
          <span className="text-xs">{name}</span>
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
          loading="lazy"
        />
      )}
      {imageInfo && imageInfo.width > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1 text-center">
          {imageInfo.width}×{imageInfo.height}
        </div>
      )}
    </div>
  );
}

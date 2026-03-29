import { Check, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ThemeInfo } from '@/hooks/useTauri';
import { openExternalUrl } from '@/hooks/useTauri';
import { useTranslation } from 'react-i18next';

interface ThemeCardProps {
  theme: ThemeInfo;
  isActive: boolean;
  onActivate: () => void;
  onUninstall: () => void;
}

export function ThemeCard({
  theme,
  isActive,
  onActivate,
  onUninstall,
}: ThemeCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        isActive ? 'border-primary bg-primary/5' : 'hover:bg-accent'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="w-24 h-16 bg-muted rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
          {theme.has_screenshot ? (
            <img
              src={`file://${theme.path}/images/screenshot.png`}
              alt={theme.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs text-muted-foreground">
              {t('theme.noPreview')}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{theme.name}</h4>
            {isActive && (
              <Badge variant="default" className="text-xs">
                {t('theme.active')}
              </Badge>
            )}
          </div>
          {theme.version && (
            <p className="text-xs text-muted-foreground">
              {t('theme.version')}: {theme.version}
            </p>
          )}
          {theme.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {theme.description}
            </p>
          )}
          {theme.author && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('theme.by')} {theme.author}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button
          size="sm"
          className="flex-1"
          variant={isActive ? 'secondary' : 'default'}
          onClick={onActivate}
          disabled={isActive}
        >
          {isActive ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              {t('theme.active')}
            </>
          ) : (
            t('theme.activate')
          )}
        </Button>
        {theme.source && (
          <Button
            variant="outline"
            size="icon"
            onClick={async () => {
              try {
                let url = theme.source!;
                // Ensure URL has protocol
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                  url = 'https://' + url;
                }
                console.log('Opening URL:', url);
                await openExternalUrl(url);
              } catch (err) {
                console.error('Failed to open URL:', err);
                alert(t('theme.openUrlFailed', '无法打开链接'));
              }
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={onUninstall}
          disabled={isActive}
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

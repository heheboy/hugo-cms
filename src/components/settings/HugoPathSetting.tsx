import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSearch, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSettingsStore } from '@/stores/settingsStore';
import { verifyHugoPath, detectHugoPath } from '@/hooks/useTauri';
import { open } from '@tauri-apps/plugin-dialog';

export function HugoPathSetting() {
  const { t } = useTranslation();
  const { settings, setHugoPath } = useSettingsStore();
  const [path, setPath] = useState(settings.hugoPath || '');
  const [version, setVersion] = useState<string | null>(settings.hugoVersion);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleVerify = useCallback(async () => {
    if (!path.trim()) {
      // If empty, use system default
      setHugoPath(null);
      setVersion(null);
      setSuccess(true);
      setError(null);
      return;
    }

    setIsVerifying(true);
    setError(null);
    setSuccess(false);

    try {
      const versionOutput = await verifyHugoPath(path);
      setVersion(versionOutput);
      setHugoPath(path);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setVersion(null);
    } finally {
      setIsVerifying(false);
    }
  }, [path, setHugoPath]);

  const handleAutoDetect = useCallback(async () => {
    setIsAutoDetecting(true);
    setError(null);
    setSuccess(false);

    try {
      const detectedPath = await detectHugoPath();
      if (detectedPath) {
        setPath(detectedPath);
        // Also verify to get version
        const versionOutput = await verifyHugoPath(detectedPath);
        setVersion(versionOutput);
        setHugoPath(detectedPath);
        setSuccess(true);
      } else {
        setError(t('app.errors.hugoNotFound'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAutoDetecting(false);
    }
  }, [setHugoPath, t]);

  const handleBrowse = useCallback(async () => {
    const selected = await open({
      multiple: false,
      directory: false,
    });

    if (selected && typeof selected === 'string') {
      setPath(selected);
      setError(null);
      setSuccess(false);
      // Automatically save the selected path
      setHugoPath(selected);
    }
  }, [setHugoPath]);

  // Verify on mount if path exists
  useEffect(() => {
    if (settings.hugoPath) {
      handleVerify();
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hugo-path">{t('settings.hugo.path')}</Label>
        <div className="flex gap-2">
          <Input
            id="hugo-path"
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            placeholder={t('settings.hugo.pathPlaceholder')}
            className="flex-1"
          />
          <Button variant="outline" onClick={handleBrowse}>
            <FileSearch className="h-4 w-4 mr-2" />
            {t('common.actions.browse')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('settings.hugo.pathHint')}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleVerify}
          disabled={isVerifying}
          variant="outline"
        >
          {isVerifying ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          {t('settings.hugo.verify')}
        </Button>
        <Button
          onClick={handleAutoDetect}
          disabled={isAutoDetecting}
          variant="outline"
        >
          {isAutoDetecting ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileSearch className="h-4 w-4 mr-2" />
          )}
          {t('settings.hugo.autoDetect')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && version && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>
            {t('settings.hugo.version')}: {version.split('\n')[0]}
          </AlertDescription>
        </Alert>
      )}

      {!settings.hugoPath && !error && (
        <Alert variant="default" className="bg-muted">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('settings.hugo.usingSystem')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

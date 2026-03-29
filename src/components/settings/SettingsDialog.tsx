import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HugoPathSetting } from './HugoPathSetting';
import { EditorSettings } from './EditorSettings';
import { PreviewSettings } from './PreviewSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { useSettingsStore } from '@/stores/settingsStore';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const { settings, setLanguage } = useSettingsStore();

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('settings.title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">
              {t('settings.tabs.general')}
            </TabsTrigger>
            <TabsTrigger value="editor">
              {t('settings.tabs.editor')}
            </TabsTrigger>
            <TabsTrigger value="preview">
              {t('settings.tabs.preview')}
            </TabsTrigger>
            <TabsTrigger value="appearance">
              {t('settings.tabs.appearance')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">{t('settings.hugo.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('settings.hugo.description')}
              </p>
              <HugoPathSetting />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-medium">{t('settings.language.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('settings.language.description')}
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={settings.language === 'zh-CN' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleLanguageChange('zh-CN')}
                >
                  {t('common.language.zhCN')}
                </Button>
                <Button
                  variant={settings.language === 'en' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleLanguageChange('en')}
                >
                  {t('common.language.en')}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="editor" className="space-y-4 mt-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">{t('settings.editor.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('settings.editor.description')}
              </p>
              <EditorSettings />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">{t('settings.preview.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('settings.preview.description')}
              </p>
              <PreviewSettings />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">{t('settings.appearance.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('settings.appearance.description')}
              </p>
              <AppearanceSettings />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            {t('common.actions.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

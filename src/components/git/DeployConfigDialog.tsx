import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import {
  saveDeployConfig,
  loadDeployConfig,
  type DeployConfig,
} from '@/hooks/useTauri';

interface DeployConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/// Derive path prefix from GitHub repository URL
/// e.g., https://github.com/user/blog.git -> "/blog"
/// e.g., https://github.com/user/user.github.io.git -> ""
function derivePathPrefix(repoUrl: string): string {
  // Remove .git suffix if present
  const url = repoUrl.trim().replace(/\.git$/, '');

  // Extract username and repo name
  let username = '';
  let repoName = '';

  if (url.startsWith('https://github.com/')) {
    const parts = url.substring('https://github.com/'.length).split('/');
    if (parts.length >= 2) {
      username = parts[0];
      repoName = parts[1];
    }
  } else if (url.startsWith('git@github.com:')) {
    const parts = url.substring('git@github.com:'.length).split('/');
    if (parts.length >= 2) {
      username = parts[0];
      repoName = parts[1];
    }
  }

  if (!username || !repoName) return '';

  // Check if it's a user/org page (repo name matches username.github.io)
  const expectedUserPage = `${username}.github.io`;
  if (repoName === expectedUserPage) {
    // User/Organization page: no path prefix
    return '';
  } else {
    // Project page: use repo name as path prefix
    return `/${repoName}`;
  }
}

export function DeployConfigDialog({ open, onOpenChange }: DeployConfigDialogProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [repoUrl, setRepoUrl] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!currentProject) return;

    try {
      const config = await loadDeployConfig(currentProject.path);
      if (config) {
        setRepoUrl(config.repo_url);
        setUserName(config.user_name);
        setUserEmail(config.user_email);
        setTargetBranch(config.target_branch || 'main');
      }
    } catch (err) {
      console.error('Failed to load deploy config:', err);
    }
  }, [currentProject]);

  useEffect(() => {
    if (open && currentProject) {
      loadConfig();
    }
  }, [open, currentProject, loadConfig]);

  const handleSave = async () => {
    if (!currentProject) return;

    if (!repoUrl.trim() || !userName.trim() || !userEmail.trim()) {
      setError(t('deploy.config.required', '请填写所有必填项'));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const pathPrefix = derivePathPrefix(repoUrl.trim());

      const config: DeployConfig = {
        repo_url: repoUrl.trim(),
        user_name: userName.trim(),
        user_email: userEmail.trim(),
        path_prefix: pathPrefix,
        target_branch: targetBranch.trim() || 'main',
      };

      await saveDeployConfig(currentProject.path, config);
      setSuccess(t('deploy.config.saveSuccess', '部署配置保存成功'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save deploy config:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('deploy.config.title', '部署配置')}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {!currentProject && (
          <div className="text-center py-4 text-muted-foreground">
            {t('deploy.noProject', '请先打开一个项目')}
          </div>
        )}

        {currentProject && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="repo-url">
                {t('deploy.config.repoUrl', '部署仓库 URL')}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="repo-url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/username.github.io.git"
              />
              <p className="text-xs text-muted-foreground">
                {t('deploy.config.repoUrlHint', '用于 GitHub Pages 的仓库地址')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-name">
                {t('deploy.config.userName', 'Git 用户名')}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="user-name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email">
                {t('deploy.config.userEmail', 'Git 邮箱')}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="user-email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-branch">
                {t('deploy.config.targetBranch', '目标分支')}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="target-branch"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="main"
              />
              <p className="text-xs text-muted-foreground">
                {t('deploy.config.targetBranchHint', '部署时推送到的目标分支，如：main、master、gh-pages')}
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? t('common.saving', '保存中...') : t('common.save', '保存配置')}
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t('deploy.config.note1', '配置将保存到项目目录的 .hugo-cms-deploy.json 文件中')}</p>
              <p>{t('deploy.config.note2', '部署时会执行：hugo build → git push --force 到配置的目标分支')}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitBranch,
  Plus,
  Minus,
  RotateCcw,
  Upload,
  Download,
  Eye,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectStore } from '@/stores/projectStore';
import {
  gitStatus,
  gitAdd,
  gitReset,
  gitPush,
  gitPull,
  type GitStatusResult,
} from '@/hooks/useTauri';
import { BranchSelector } from './BranchSelector';
import { GitCommitDialog } from './GitCommitDialog';
import { GitHistory } from './GitHistory';
import { GitDiff } from './GitDiff';
import { GitStashManager } from './GitStashManager';
import { GitTagManager } from './GitTagManager';
import { GitRemoteManager } from './GitRemoteManager';

export function GitPanel() {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [diffFile, setDiffFile] = useState<string | null>(null);
  const [diffStaged, setDiffStaged] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('changes');
  const isCancelledRef = useRef(false);

  const loadStatus = useCallback(async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      isCancelledRef.current = false;
      const result = await gitStatus(currentProject.path);
      if (!isCancelledRef.current) {
        setStatus(result);
      }
    } catch (err) {
      if (!isCancelledRef.current) {
        console.error('Failed to load git status:', err);
      }
    } finally {
      if (!isCancelledRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentProject]);

  useEffect(() => {
    loadStatus();

    return () => {
      isCancelledRef.current = true;
    };
  }, [loadStatus]);

  const handleStage = async (file: string) => {
    if (!currentProject) return;

    try {
      await gitAdd(currentProject.path, [file]);
      await loadStatus();
    } catch (err) {
      console.error('Failed to stage file:', err);
    }
  };

  const handleUnstage = async (file: string) => {
    if (!currentProject) return;

    try {
      await gitReset(currentProject.path, [file]);
      await loadStatus();
    } catch (err) {
      console.error('Failed to unstage file:', err);
    }
  };

  const handleStageAll = async () => {
    if (!currentProject || !status) return;

    try {
      await gitAdd(currentProject.path, ['.']);
      await loadStatus();
    } catch (err) {
      console.error('Failed to stage all:', err);
    }
  };

  const handlePush = async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      await gitPush(currentProject.path);
      await loadStatus();
    } catch (err) {
      console.error('Failed to push:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePull = async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      await gitPull(currentProject.path);
      await loadStatus();
    } catch (err) {
      console.error('Failed to pull:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openDiff = (file: string, staged: boolean) => {
    setDiffFile(file);
    setDiffStaged(staged);
    setIsDiffOpen(true);
  };

  const hasChanges =
    status &&
    (status.staged.length > 0 ||
      status.modified.length > 0 ||
      status.untracked.length > 0);

  if (!currentProject) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{t('git.noProject')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <BranchSelector
            currentBranch={status?.branch || 'main'}
            onBranchChange={loadStatus}
          />
          {status && status.ahead > 0 && (
            <Badge variant="secondary" className="text-xs">
              ↑{status.ahead}
            </Badge>
          )}
          {status && status.behind > 0 && (
            <Badge variant="secondary" className="text-xs">
              ↓{status.behind}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handlePull} disabled={isLoading}>
            <Download className="h-4 w-4 mr-1" />
            {t('git.pull')}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePush} disabled={isLoading}>
            <Upload className="h-4 w-4 mr-1" />
            {t('git.push')}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-full justify-start rounded-none border-b px-3">
          <TabsTrigger value="changes">
            {t('git.changes')}
            {hasChanges && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({status?.staged.length || 0}/{status?.modified.length || 0})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">{t('git.history')}</TabsTrigger>
          <TabsTrigger value="stash">{t('git.stash')}</TabsTrigger>
          <TabsTrigger value="tags">{t('git.tags')}</TabsTrigger>
          <TabsTrigger value="remotes">{t('git.remotes')}</TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="flex-1 h-full mt-0">
          <div className="h-full flex flex-col">
            {/* Staged */}
            <div className="flex-1">
              <div className="flex items-center justify-between p-2 bg-muted/50">
                <span className="text-sm font-medium">
                  {t('git.staged')} ({status?.staged.length || 0})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCommitDialogOpen(true)}
                  disabled={!status?.staged.length}
                >
                  {t('git.commit')}
                </Button>
              </div>
              <ScrollArea className="h-[120px]">
                {status?.staged.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    {t('git.noStagedFiles')}
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {status?.staged.map((file) => (
                      <div
                        key={file}
                        className="flex items-center justify-between p-2 rounded hover:bg-accent group"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Plus className="h-4 w-4 text-green-500 shrink-0" />
                          <span className="text-sm truncate">{file}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => openDiff(file, true)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => handleUnstage(file)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <Separator />

            {/* Changes */}
            <div className="flex-1">
              <div className="flex items-center justify-between p-2 bg-muted/50">
                <span className="text-sm font-medium">
                  {t('git.changes')} ({status?.modified.length || 0})
                </span>
                <Button variant="ghost" size="sm" onClick={handleStageAll}>
                  {t('git.stageAll')}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-1 p-2">
                  {/* Modified */}
                  {status?.modified.map((file) => (
                    <div
                      key={file}
                      className="flex items-center justify-between p-2 rounded hover:bg-accent group"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <RotateCcw className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-sm truncate">{file}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={() => openDiff(file, false)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={() => handleStage(file)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Untracked */}
                  {status?.untracked.map((file) => (
                    <div
                      key={file}
                      className="flex items-center justify-between p-2 rounded hover:bg-accent group"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate text-muted-foreground">
                          {file}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => handleStage(file)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {status?.modified.length === 0 && status?.untracked.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      {t('git.noChanges')}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="h-full mt-0">
          <GitHistory />
        </TabsContent>

        <TabsContent value="stash" className="h-full mt-0">
          <GitStashManager />
        </TabsContent>

        <TabsContent value="tags" className="h-full mt-0">
          <GitTagManager />
        </TabsContent>

        <TabsContent value="remotes" className="h-full mt-0">
          <GitRemoteManager />
        </TabsContent>
      </Tabs>

      <GitCommitDialog
        open={isCommitDialogOpen}
        onOpenChange={setIsCommitDialogOpen}
        onCommit={loadStatus}
        stagedCount={status?.staged.length || 0}
      />

      <GitDiff
        file={diffFile}
        staged={diffStaged}
        open={isDiffOpen}
        onOpenChange={setIsDiffOpen}
      />
    </div>
  );
}

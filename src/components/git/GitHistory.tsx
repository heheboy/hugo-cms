import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GitCommit, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectStore } from '@/stores/projectStore';
import { gitLog, type GitCommit as GitCommitType } from '@/hooks/useTauri';

export function GitHistory() {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [commits, setCommits] = useState<GitCommitType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      const log = await gitLog(currentProject.path, 50);
      setCommits(log);
    } catch (err) {
      console.error('Failed to load git history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (isLoading && commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <GitCommit className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{t('git.noCommits')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">{t('git.commitHistory')}</h3>
        <Button variant="ghost" size="sm" onClick={loadHistory} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <ScrollArea className="flex-1 -mx-2">
        <div className="space-y-2 px-2">
          {commits.map((commit) => (
            <div
              key={commit.hash}
              className="p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-start gap-2">
                <GitCommit className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2">
                    {commit.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{commit.short_hash}</span>
                    <span>·</span>
                    <span className="truncate">{commit.author}</span>
                    <span>·</span>
                    <span>{commit.date}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyHash(commit.hash)}
                >
                  {copiedHash === commit.hash ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

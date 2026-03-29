import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectStore } from '@/stores/projectStore';
import { gitDiff } from '@/hooks/useTauri';

interface GitDiffProps {
  file: string | null;
  staged: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GitDiff({ file, staged, open, onOpenChange }: GitDiffProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [diff, setDiff] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !currentProject) return;

    const loadDiff = async () => {
      try {
        setIsLoading(true);
        const diffText = await gitDiff(currentProject.path, file || undefined, staged);
        setDiff(diffText);
      } catch (err) {
        console.error('Failed to load diff:', err);
        setDiff('');
      } finally {
        setIsLoading(false);
      }
    };

    loadDiff();
  }, [open, file, staged, currentProject]);

  const renderDiffLine = (line: string, index: number) => {
    let className = 'font-mono text-sm px-2 py-0.5';
    let content = line;

    if (line.startsWith('+')) {
      className += ' bg-green-500/10 text-green-700 dark:text-green-300';
    } else if (line.startsWith('-')) {
      className += ' bg-red-500/10 text-red-700 dark:text-red-300';
    } else if (line.startsWith('@@')) {
      className += ' text-blue-600 dark:text-blue-400 bg-blue-500/5';
    } else if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
      className += ' text-muted-foreground bg-muted';
    }

    return (
      <div key={index} className={className}>
        <pre className="whitespace-pre-wrap break-all">{content}</pre>
      </div>
    );
  };

  const lines = diff.split('\n');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {file || t('git.allChanges')}
            {staged && (
              <span className="text-xs px-2 py-0.5 bg-primary/10 rounded">
                {t('git.staged')}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : diff ? (
            <ScrollArea className="h-[60vh] -mx-6 px-6">
              <div className="border rounded-lg overflow-hidden">
                {lines.map((line, index) => renderDiffLine(line, index))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('git.noChanges')}
            </div>
          )}
        </div>

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

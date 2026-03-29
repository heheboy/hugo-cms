import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitCommit, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useProjectStore } from '@/stores/projectStore';
import { gitCommit } from '@/hooks/useTauri';

interface GitCommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: () => void;
  stagedCount: number;
}

export function GitCommitDialog({
  open,
  onOpenChange,
  onCommit,
  stagedCount,
}: GitCommitDialogProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [message, setMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const handleCommit = async () => {
    if (!currentProject || !message.trim()) return;

    try {
      setIsCommitting(true);
      await gitCommit(currentProject.path, message.trim());
      setMessage('');
      onCommit();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to commit:', err);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            {t('git.commitTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="commit-message">
              {t('git.commitMessage')}
            </Label>
            <Textarea
              id="commit-message"
              placeholder={t('git.commitMessagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {t('git.filesToCommit', { count: stagedCount })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleCommit}
            disabled={!message.trim() || isCommitting || stagedCount === 0}
          >
            {isCommitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('git.committing')}
              </>
            ) : (
              <>
                <GitCommit className="h-4 w-4 mr-2" />
                {t('git.commit')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

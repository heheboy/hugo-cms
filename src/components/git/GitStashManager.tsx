import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, RotateCcw, Trash2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/stores/projectStore';
import {
  gitStashList,
  gitStashSave,
  gitStashPop,
  gitStashDrop,
  gitStashApply,
  type GitStash,
} from '@/hooks/useTauri';

export function GitStashManager() {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [stashes, setStashes] = useState<GitStash[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [stashMessage, setStashMessage] = useState('');

  const loadStashes = useCallback(async () => {
    if (!currentProject) return;

    try {
      const result = await gitStashList(currentProject.path);
      setStashes(result);
    } catch (err) {
      console.error('Failed to load stashes:', err);
    }
  }, [currentProject]);

  useEffect(() => {
    loadStashes();
  }, [loadStashes]);

  const handleSave = async () => {
    if (!currentProject) return;

    try {
      await gitStashSave(currentProject.path, stashMessage || undefined);
      setStashMessage('');
      setIsCreateOpen(false);
      await loadStashes();
    } catch (err) {
      console.error('Failed to save stash:', err);
    }
  };

  const handlePop = async (index: number) => {
    if (!currentProject) return;

    try {
      await gitStashPop(currentProject.path, index);
      await loadStashes();
    } catch (err) {
      console.error('Failed to pop stash:', err);
    }
  };

  const handleApply = async (index: number) => {
    if (!currentProject) return;

    try {
      await gitStashApply(currentProject.path, index);
      await loadStashes();
    } catch (err) {
      console.error('Failed to apply stash:', err);
    }
  };

  const handleDrop = async (index: number) => {
    if (!currentProject) return;

    try {
      await gitStashDrop(currentProject.path, index);
      await loadStashes();
    } catch (err) {
      console.error('Failed to drop stash:', err);
    }
  };

  if (!currentProject) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Archive className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{t('git.noProject')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4" />
          <span className="font-medium">
            {t('git.stashes')} ({stashes.length})
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t('git.stashSave')}
        </Button>
      </div>

      <Separator />

      {/* Stash List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {stashes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('git.noStashes')}</p>
            </div>
          ) : (
            stashes.map((stash) => (
              <div
                key={stash.index}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      stash@{stash.index}
                    </Badge>
                    <span className="font-medium truncate">
                      {stash.message || t('git.noStashMessage')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stash.branch} • {stash.hash.substring(0, 7)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePop(stash.index)}
                    title={t('git.stashPop')}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleApply(stash.index)}
                    title={t('git.stashApply')}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDrop(stash.index)}
                    title={t('git.stashDrop')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create Stash Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('git.createStash')}</DialogTitle>
            <DialogDescription>{t('git.createStashDescription')}</DialogDescription>
          </DialogHeader>
          <Input
            value={stashMessage}
            onChange={(e) => setStashMessage(e.target.value)}
            placeholder={t('git.stashMessagePlaceholder')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleSave}>
              {t('git.stashSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

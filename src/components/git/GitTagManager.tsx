import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Plus, Trash2, Upload, GitCommit } from 'lucide-react';
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
  gitTagList,
  gitTagCreate,
  gitTagDelete,
  gitTagPush,
  type GitTag,
} from '@/hooks/useTauri';

export function GitTagManager() {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [tags, setTags] = useState<GitTag[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagMessage, setTagMessage] = useState('');
  const [tagCommit, setTagCommit] = useState('');

  const loadTags = useCallback(async () => {
    if (!currentProject) return;

    try {
      const result = await gitTagList(currentProject.path);
      setTags(result);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }, [currentProject]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleCreate = async () => {
    if (!currentProject || !tagName.trim()) return;

    try {
      await gitTagCreate(
        currentProject.path,
        tagName.trim(),
        tagMessage.trim() || undefined,
        tagCommit.trim() || undefined
      );
      setTagName('');
      setTagMessage('');
      setTagCommit('');
      setIsCreateOpen(false);
      await loadTags();
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  };

  const handleDelete = async (name: string) => {
    if (!currentProject) return;

    try {
      await gitTagDelete(currentProject.path, name);
      await loadTags();
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  const handlePush = async (name?: string) => {
    if (!currentProject) return;

    try {
      await gitTagPush(currentProject.path, name);
      await loadTags();
    } catch (err) {
      console.error('Failed to push tag:', err);
    }
  };

  if (!currentProject) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Tag className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{t('git.noProject')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          <span className="font-medium">
            {t('git.tags')} ({tags.length})
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handlePush()}>
            <Upload className="h-4 w-4 mr-1" />
            {t('git.pushAllTags')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('git.createTag')}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Tag List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('git.noTags')}</p>
            </div>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.name}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">{tag.name}</span>
                    {tag.message && (
                      <Badge variant="secondary" className="text-xs">
                        annotated
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <GitCommit className="h-3 w-3" />
                    {tag.hash.substring(0, 7)}
                  </p>
                  {tag.message && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {tag.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePush(tag.name)}
                    title={t('git.pushTag')}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(tag.name)}
                    title={t('git.deleteTag')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create Tag Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('git.createTag')}</DialogTitle>
            <DialogDescription>{t('git.createTagDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('git.tagName')}</label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="v1.0.0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('git.tagMessage')}</label>
              <Input
                value={tagMessage}
                onChange={(e) => setTagMessage(e.target.value)}
                placeholder={t('git.tagMessagePlaceholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('git.tagCommit')}</label>
              <Input
                value={tagCommit}
                onChange={(e) => setTagCommit(e.target.value)}
                placeholder={t('git.tagCommitPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!tagName.trim()}>
              {t('common.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

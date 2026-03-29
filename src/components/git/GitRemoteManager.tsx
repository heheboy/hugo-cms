import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Plus, Trash2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
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
  gitRemoteList,
  gitRemoteAdd,
  gitRemoteRemove,
  type GitRemote,
} from '@/hooks/useTauri';

export function GitRemoteManager() {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [remoteName, setRemoteName] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');

  const loadRemotes = useCallback(async () => {
    if (!currentProject) return;

    try {
      const result = await gitRemoteList(currentProject.path);
      setRemotes(result);
    } catch (err) {
      console.error('Failed to load remotes:', err);
    }
  }, [currentProject]);

  useEffect(() => {
    loadRemotes();
  }, [loadRemotes]);

  const handleAdd = async () => {
    if (!currentProject || !remoteName.trim() || !remoteUrl.trim()) return;

    try {
      await gitRemoteAdd(currentProject.path, remoteName.trim(), remoteUrl.trim());
      setRemoteName('');
      setRemoteUrl('');
      setIsCreateOpen(false);
      await loadRemotes();
    } catch (err) {
      console.error('Failed to add remote:', err);
    }
  };

  const handleRemove = async (name: string) => {
    if (!currentProject) return;

    try {
      await gitRemoteRemove(currentProject.path, name);
      await loadRemotes();
    } catch (err) {
      console.error('Failed to remove remote:', err);
    }
  };

  if (!currentProject) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{t('git.noProject')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span className="font-medium">
            {t('git.remotes')} ({remotes.length})
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t('git.addRemote')}
        </Button>
      </div>

      <Separator />

      {/* Remote List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {remotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('git.noRemotes')}</p>
            </div>
          ) : (
            remotes.map((remote) => (
              <div
                key={remote.name}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{remote.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                    {remote.url}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleRemove(remote.name)}
                  title={t('git.removeRemote')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add Remote Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('git.addRemote')}</DialogTitle>
            <DialogDescription>{t('git.addRemoteDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('git.remoteName')}</label>
              <Input
                value={remoteName}
                onChange={(e) => setRemoteName(e.target.value)}
                placeholder="origin"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('git.remoteUrl')}</label>
              <Input
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleAdd} disabled={!remoteName.trim() || !remoteUrl.trim()}>
              {t('common.actions.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitBranch,
  Plus,
  RefreshCw,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjectStore } from '@/stores/projectStore';
import {
  gitBranchList,
  gitCheckout,
  gitCreateBranch,
  type GitBranch as GitBranchType,
} from '@/hooks/useTauri';

interface BranchSelectorProps {
  currentBranch: string;
  onBranchChange: () => void;
}

export function BranchSelector({ currentBranch, onBranchChange }: BranchSelectorProps) {
  const { t } = useTranslation();
  const { currentProject } = useProjectStore();
  const [branches, setBranches] = useState<GitBranchType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [checkoutNewBranch, setCheckoutNewBranch] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const loadBranches = useCallback(async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      const branchList = await gitBranchList(currentProject.path);
      setBranches(branchList.filter((b) => !b.is_remote));
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handleCheckout = async (branchName: string) => {
    if (!currentProject || branchName === currentBranch) return;

    try {
      await gitCheckout(currentProject.path, branchName);
      onBranchChange();
      await loadBranches();
    } catch (err) {
      console.error('Failed to checkout branch:', err);
    }
  };

  const handleCreateBranch = async () => {
    if (!currentProject || !newBranchName.trim()) return;

    try {
      setIsCreating(true);
      await gitCreateBranch(
        currentProject.path,
        newBranchName.trim(),
        checkoutNewBranch
      );
      setIsCreateDialogOpen(false);
      setNewBranchName('');
      onBranchChange();
      await loadBranches();
    } catch (err) {
      console.error('Failed to create branch:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="min-w-[120px]">
            <GitBranch className="h-4 w-4 mr-2" />
            <span className="truncate">{currentBranch}</span>
            <ChevronDown className="h-3 w-3 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem
            className="flex items-center gap-2"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t('git.createBranch')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="max-h-48 overflow-y-auto">
            {branches.map((branch) => (
              <DropdownMenuItem
                key={branch.name}
                className="flex items-center justify-between"
                onClick={() => handleCheckout(branch.name)}
                disabled={branch.name === currentBranch}
              >
                <span className="truncate">{branch.name}</span>
                {branch.name === currentBranch && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 text-muted-foreground"
            onClick={loadBranches}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            {t('git.refreshBranches')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('git.createBranch')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">{t('git.branchName')}</Label>
              <Input
                id="branch-name"
                placeholder="feature/new-branch"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checkoutNewBranch}
                onChange={(e) => setCheckoutNewBranch(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{t('git.checkoutNewBranch')}</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={handleCreateBranch}
              disabled={!newBranchName.trim() || isCreating}
            >
              {isCreating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {t('git.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

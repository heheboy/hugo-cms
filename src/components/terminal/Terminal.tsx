import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal as TerminalIcon, Trash2, Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  useCommandHistoryStore,
  type CommandHistory,
} from '@/stores/commandHistoryStore';
import { executeCommandWithHistory, hugoServer } from '@/hooks/useTauri';

interface TerminalProps {
  projectPath: string | null;
}

export function Terminal({ projectPath }: TerminalProps) {
  const { t } = useTranslation();
  const { settings } = useSettingsStore();
  const terminalHeight = settings.appearance.terminalHeight;
  const { commands, clearCommands, getFullCommandString } = useCommandHistoryStore();

  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const _terminalRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new commands are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [commands]);

  // Parse command line arguments to extract values
  const parseArgValue = (args: string[], ...flags: string[]): string | undefined => {
    for (const flag of flags) {
      const index = args.indexOf(flag);
      if (index !== -1 && index + 1 < args.length) {
        return args[index + 1];
      }
    }
    return undefined;
  };

  const hasFlag = (args: string[], ...flags: string[]): boolean => {
    return flags.some(flag => args.includes(flag));
  };

  const executeCommandWrapper = useCallback(
    async (cmd: string) => {
      if (!cmd.trim() || !projectPath) {
        return;
      }

      // Add to local history for arrow key navigation
      setHistory((prev) => [...prev, cmd]);
      setHistoryIndex(-1);
      setInput('');
      setIsExecuting(true);

      try {
        // Parse command
        const parts = cmd.trim().split(' ');
        const command = parts[0];
        const args = parts.slice(1);

        // Special handling for hugo server only (long-running process)
        // All other commands (including hugo new/build) execute as-is
        if (command === 'hugo' && (args[0] === 'server' || args.includes('server'))) {
          // Parse user-provided arguments
          const portStr = parseArgValue(args, '--port', '-p');
          const bind = parseArgValue(args, '--bind', '-b');
          const baseURL = parseArgValue(args, '--baseURL', '-b');
          const buildDrafts = hasFlag(args, '-D', '--buildDrafts');
          const disableLiveReload = hasFlag(args, '--disableLiveReload');
          const renderToDisk = hasFlag(args, '--renderToDisk');
          const appendPort = !hasFlag(args, '--appendPort=false', '--appendPort=false');

          const port = portStr ? parseInt(portStr, 10) : undefined;

          // Call hugoServer with parsed options
          const actualPort = await hugoServer(projectPath, {
            port,
            bind,
            baseURL,
            buildDrafts,
          });
          setIsServerRunning(true);
          // Note: hugoServer manages its own history entry via the store
          setIsExecuting(false);
          return;
        }

        // All other commands execute as-is (generic shell execution)
        await executeCommandWithHistory(projectPath, command, args);
      } catch (error) {
        console.error('Command execution error:', error);
      } finally {
        setIsExecuting(false);
      }
    },
    [projectPath]
  );

  const handleQuickCommand = useCallback(
    async (cmd: string) => {
      setInput(cmd);
      await executeCommandWrapper(cmd);
    },
    [executeCommandWrapper]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommandWrapper(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const clearTerminal = () => {
    clearCommands();
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const quickCommands = [
    { label: t('terminal.quickCommands.hugoServer'), cmd: 'hugo server -D' },
    { label: t('terminal.quickCommands.hugoBuild'), cmd: 'hugo' },
    { label: t('terminal.quickCommands.hugoNew'), cmd: 'hugo new content posts/my-post.md' },
    { label: t('terminal.quickCommands.gitStatus'), cmd: 'git status' },
    { label: t('terminal.quickCommands.gitAdd'), cmd: 'git add .' },
    { label: t('terminal.quickCommands.gitCommit'), cmd: 'git commit -m "update"' },
  ];

  return (
    <div
      className="flex flex-col border-t bg-card"
      style={{ height: terminalHeight }}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{t('terminal.title')}</span>
          {projectPath && (
            <span className="text-xs text-muted-foreground ml-2 truncate max-w-[300px]">
              {projectPath}
            </span>
          )}
          {isExecuting && (
            <Loader2 className="h-3 w-3 animate-spin ml-2" />
          )}
          {isServerRunning && (
            <span className="text-xs text-green-500 ml-2">{t('terminal.status.serverRunning')}</span>
          )}
          <span className="text-xs text-muted-foreground ml-2">
            {commands.length > 0 && `${commands.length} 个命令`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            disabled={commands.length === 0}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            {t('common.actions.clear', '清空')}
          </Button>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="flex items-center gap-2 px-4 py-1 border-b bg-muted/30 overflow-x-auto">
        {quickCommands.map((qc) => (
          <Button
            key={qc.label}
            variant="ghost"
            size="sm"
            className="text-xs h-6 whitespace-nowrap"
            onClick={() => handleQuickCommand(qc.cmd)}
            disabled={!projectPath || isExecuting}
          >
            {qc.label}
          </Button>
        ))}
      </div>

      {/* Command History */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-2 font-mono text-sm bg-black"
      >
        {commands.length === 0 ? (
          <div className="text-muted-foreground text-center py-4 opacity-50">
            {projectPath ? t('terminal.placeholders.startTyping') : t('terminal.placeholders.openProjectToEnable')}
          </div>
        ) : (
          <div className="space-y-2">
            {commands.map((cmd: CommandHistory) => (
              <div key={cmd.id} className="border-b border-gray-800 pb-2">
                {/* Command Line */}
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 text-xs shrink-0 pt-1">
                    {formatTimestamp(cmd.timestamp)}
                  </span>
                  <span className="text-blue-400 shrink-0">$</span>
                  <span className="text-white break-all">{getFullCommandString(cmd)}</span>
                  {cmd.status === 'running' && (
                    <Loader2 className="h-3 w-3 animate-spin text-yellow-400 shrink-0 ml-2" />
                  )}
                  {cmd.status === 'success' && cmd.duration && (
                    <span className="text-xs text-green-500 shrink-0 ml-2">
                      ✓ {formatDuration(cmd.duration)}
                    </span>
                  )}
                  {cmd.status === 'error' && (
                    <X className="h-3 w-3 text-red-400 shrink-0 ml-2" />
                  )}
                </div>

                {/* Output */}
                {cmd.stdout && (
                  <div className="mt-1 pl-16">
                    {cmd.stdout.split('\n').map((line: string, idx: number) => (
                      line.trim() && (
                        <div key={idx} className="text-green-400 whitespace-pre-wrap">
                          {line}
                        </div>
                      )
                    ))}
                  </div>
                )}

                {/* Error */}
                {cmd.stderr && (
                  <div className="mt-1 pl-16">
                    {cmd.stderr.split('\n').map((line: string, idx: number) => (
                      line.trim() && (
                        <div key={idx} className="text-red-400 whitespace-pre-wrap">
                          {line}
                        </div>
                      )
                    ))}
                  </div>
                )}

                {/* Exit Code (if error) */}
                {cmd.exitCode !== undefined && cmd.exitCode !== 0 && (
                  <div className="mt-1 pl-16 text-red-400 text-xs">
                    Exit code: {cmd.exitCode}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 border-t bg-card">
        <span className="text-sm font-mono text-muted-foreground">$</span>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={projectPath ? t('terminal.placeholders.typeCommand') : t('terminal.placeholders.openProjectFirst')}
          className="flex-1 h-8 font-mono text-sm"
          disabled={!projectPath || isExecuting}
        />
        <Button
          type="submit"
          size="sm"
          className="h-8 px-2"
          disabled={!projectPath || isExecuting}
        >
          {isExecuting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </Button>
      </form>
    </div>
  );
}

import { create } from 'zustand';

export interface CommandHistory {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  timestamp: number;
  status: 'running' | 'success' | 'error';
  stdout: string;
  stderr: string;
  exitCode?: number;
  duration?: number;
}

interface CommandHistoryState {
  commands: CommandHistory[];
  // Actions
  addCommand: (command: Omit<CommandHistory, 'id' | 'timestamp' | 'status'>) => string;
  updateCommand: (id: string, updates: Partial<CommandHistory>) => void;
  clearCommands: () => void;
  getFullCommandString: (cmd: CommandHistory) => string;
}

export const useCommandHistoryStore = create<CommandHistoryState>((set, _get) => ({
  commands: [],

  addCommand: (command) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCommand: CommandHistory = {
      ...command,
      id,
      timestamp: Date.now(),
      status: 'running',
    };

    set((state) => ({
      commands: [...state.commands, newCommand],
    }));

    return id;
  },

  updateCommand: (id, updates) => {
    set((state) => ({
      commands: state.commands.map((cmd) =>
        cmd.id === id ? { ...cmd, ...updates } : cmd
      ),
    }));
  },

  clearCommands: () => {
    set({ commands: [] });
  },

  getFullCommandString: (cmd: CommandHistory) => {
    // Detailed format: $ cd /path && command args...
    const argsStr = cmd.args.length > 0 ? ' ' + cmd.args.join(' ') : '';
    return `$ cd "${cmd.cwd}" && ${cmd.command}${argsStr}`;
  },
}));

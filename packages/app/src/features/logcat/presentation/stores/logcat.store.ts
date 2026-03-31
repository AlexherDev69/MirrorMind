import { create } from "zustand";
import type { LogEntry, LogLevel } from "../../domain/logcat.types";
import { MAX_LOG_ENTRIES } from "../../domain/logcat.types";

interface LogcatStore {
  readonly entries: LogEntry[];
  readonly isOpen: boolean;
  readonly isPaused: boolean;
  readonly minLevel: LogLevel;
  readonly searchFilter: string;
  addEntry: (entry: Omit<LogEntry, "id">) => void;
  toggleOpen: () => void;
  togglePause: () => void;
  setMinLevel: (level: LogLevel) => void;
  setSearchFilter: (filter: string) => void;
  clear: () => void;
}

let nextId = 0;

export const useLogcatStore = create<LogcatStore>((set, get) => ({
  entries: [],
  isOpen: false,
  isPaused: false,
  minLevel: "V",
  searchFilter: "",

  addEntry: (entry) => {
    if (get().isPaused) return;

    const newEntry: LogEntry = { ...entry, id: nextId++ };
    set((state) => {
      const entries = [...state.entries, newEntry];
      if (entries.length > MAX_LOG_ENTRIES) {
        return { entries: entries.slice(entries.length - MAX_LOG_ENTRIES) };
      }
      return { entries };
    });
  },

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  setMinLevel: (level) => set({ minLevel: level }),
  setSearchFilter: (filter) => set({ searchFilter: filter }),
  clear: () => set({ entries: [] }),
}));

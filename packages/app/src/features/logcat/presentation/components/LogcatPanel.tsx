import { useEffect, useRef, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { useLogcatStore } from "../stores/logcat.store";
import { LOG_LEVEL_COLORS, LOG_LEVEL_LABELS, LOG_LEVEL_ORDER, type LogLevel } from "../../domain/logcat.types";
import { Button } from "../../../../core/components";

interface LogcatPanelProps {
  readonly serial: string | null;
  readonly onClear: () => void;
}

export function LogcatPanel({ serial, onClear }: LogcatPanelProps) {
  const entries = useLogcatStore((s) => s.entries);
  const isOpen = useLogcatStore((s) => s.isOpen);
  const isPaused = useLogcatStore((s) => s.isPaused);
  const minLevel = useLogcatStore((s) => s.minLevel);
  const searchFilter = useLogcatStore((s) => s.searchFilter);
  const addEntry = useLogcatStore((s) => s.addEntry);
  const togglePause = useLogcatStore((s) => s.togglePause);
  const setMinLevel = useLogcatStore((s) => s.setMinLevel);
  const setSearchFilter = useLogcatStore((s) => s.setSearchFilter);
  const clear = useLogcatStore((s) => s.clear);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Listen for logcat events
  useEffect(() => {
    const unlisten = listen<{
      timestamp: string;
      pid: string;
      tid: string;
      level: string;
      tag: string;
      message: string;
    }>("logcat-line", (event) => {
      addEntry({
        timestamp: event.payload.timestamp,
        pid: event.payload.pid,
        tid: event.payload.tid,
        level: event.payload.level as LogLevel,
        tag: event.payload.tag,
        message: event.payload.message,
      });
    });

    return () => { unlisten.then((fn) => fn()); };
  }, [addEntry]);

  // Compute filtered entries
  const filteredEntries = useMemo(() => {
    const minOrder = LOG_LEVEL_ORDER[minLevel];
    const search = searchFilter.toLowerCase();

    return entries.filter((e) => {
      if (LOG_LEVEL_ORDER[e.level] < minOrder) return false;
      if (search && !e.tag.toLowerCase().includes(search) && !e.message.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });
  }, [entries, minLevel, searchFilter]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEntries.length]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const handleClear = () => {
    clear();
    onClear();
  };

  if (!isOpen) return null;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 flex flex-col" style={{ height: 200 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <span className="text-xs font-semibold text-zinc-400">Logcat</span>

        <select
          value={minLevel}
          onChange={(e) => setMinLevel(e.target.value as LogLevel)}
          className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 focus:outline-none"
        >
          {(Object.keys(LOG_LEVEL_LABELS) as LogLevel[]).map((level) => (
            <option key={level} value={level}>
              {level} — {LOG_LEVEL_LABELS[level]}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter tag or message..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="flex-1 text-xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-purple-600"
        />

        <Button variant="ghost" className="text-xs px-1.5 py-0.5" onClick={togglePause}>
          {isPaused ? "Resume" : "Pause"}
        </Button>
        <Button variant="ghost" className="text-xs px-1.5 py-0.5" onClick={handleClear}>
          Clear
        </Button>

        <span className="text-xs text-zinc-600">{filteredEntries.length}</span>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-xs leading-relaxed px-2 py-1"
      >
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600">
            {serial ? (entries.length === 0 ? "Waiting for logs..." : "No logs match filters") : "No device connected"}
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="flex gap-1.5 hover:bg-zinc-900/50 px-1 rounded">
              <span className="text-zinc-600 shrink-0 w-[140px]">{entry.timestamp}</span>
              <span className={`shrink-0 w-3 font-bold ${LOG_LEVEL_COLORS[entry.level]}`}>{entry.level}</span>
              <span className="text-purple-300 shrink-0 max-w-[120px] truncate">{entry.tag}</span>
              <span className={`min-w-0 break-all ${LOG_LEVEL_COLORS[entry.level]}`}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

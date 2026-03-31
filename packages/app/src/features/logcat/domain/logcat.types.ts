export type LogLevel = "V" | "D" | "I" | "W" | "E" | "F";

export interface LogEntry {
  readonly id: number;
  readonly timestamp: string;
  readonly pid: string;
  readonly tid: string;
  readonly level: LogLevel;
  readonly tag: string;
  readonly message: string;
}

export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  V: 0,
  D: 1,
  I: 2,
  W: 3,
  E: 4,
  F: 5,
};

export const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  V: "text-zinc-500",
  D: "text-purple-400",
  I: "text-green-400",
  W: "text-yellow-400",
  E: "text-red-400",
  F: "text-red-500 font-bold",
};

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  V: "Verbose",
  D: "Debug",
  I: "Info",
  W: "Warning",
  E: "Error",
  F: "Fatal",
};

export const MAX_LOG_ENTRIES = 5000;

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_COLORS: Record<LogLevel, string> = {
  debug: "color: #6b7280",
  info: "color: #3b82f6",
  warn: "color: #f59e0b",
  error: "color: #ef4444",
};

const IS_DEV = import.meta.env.DEV;

function log(level: LogLevel, tag: string, message: string, ...args: unknown[]) {
  // In production, only log warnings and errors
  if (!IS_DEV && (level === "debug" || level === "info")) return;

  const timestamp = new Date().toISOString().slice(11, 23);
  const prefix = `%c[${timestamp}] [${tag}]`;

  switch (level) {
    case "debug":
      console.debug(prefix, LOG_COLORS.debug, message, ...args);
      break;
    case "info":
      console.info(prefix, LOG_COLORS.info, message, ...args);
      break;
    case "warn":
      console.warn(prefix, LOG_COLORS.warn, message, ...args);
      break;
    case "error":
      console.error(prefix, LOG_COLORS.error, message, ...args);
      break;
  }
}

/** Create a scoped logger with a fixed tag. */
export function createLogger(tag: string) {
  return {
    debug: (message: string, ...args: unknown[]) => log("debug", tag, message, ...args),
    info: (message: string, ...args: unknown[]) => log("info", tag, message, ...args),
    warn: (message: string, ...args: unknown[]) => log("warn", tag, message, ...args),
    error: (message: string, ...args: unknown[]) => log("error", tag, message, ...args),
  };
}

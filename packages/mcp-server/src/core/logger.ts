/**
 * Logger that writes to stderr (stdout is reserved for MCP stdio protocol).
 */

const PREFIX = "[mirror-mind]";

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(msg: string): void {
    process.stderr.write(`${PREFIX} [INFO] ${timestamp()} ${msg}\n`);
  },

  warn(msg: string): void {
    process.stderr.write(`${PREFIX} [WARN] ${timestamp()} ${msg}\n`);
  },

  error(msg: string): void {
    process.stderr.write(`${PREFIX} [ERROR] ${timestamp()} ${msg}\n`);
  },
} as const;

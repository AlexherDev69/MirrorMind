import type { RecordedAction, MacroSession } from "../domain/recorder.types";

interface BatchAction {
  readonly action: string;
  readonly [key: string]: unknown;
}

/**
 * Convert recorded actions to MCP phone_batch format.
 * Inserts `wait` actions between steps based on timestamps.
 */
export function toMcpBatch(actions: RecordedAction[]): BatchAction[] {
  const batch: BatchAction[] = [];

  for (let i = 0; i < actions.length; i++) {
    const act = actions[i]!;

    // Insert wait between actions (skip for first action)
    if (i > 0) {
      const prev = actions[i - 1]!;
      const delay = act.timestamp - prev.timestamp;
      if (delay > 100) {
        batch.push({ action: "wait", ms: delay });
      }
    }

    switch (act.type) {
      case "tap": {
        const p = act.params as { x: number; y: number };
        batch.push({ action: "tap", x: p.x, y: p.y });
        break;
      }
      case "swipe": {
        const p = act.params as { startX: number; startY: number; endX: number; endY: number; durationMs: number };
        batch.push({
          action: "swipe",
          startX: p.startX,
          startY: p.startY,
          endX: p.endX,
          endY: p.endY,
          durationMs: p.durationMs,
        });
        break;
      }
      case "type": {
        const p = act.params as { text: string };
        batch.push({ action: "type", text: p.text });
        break;
      }
      case "key": {
        const p = act.params as { keycode: number };
        batch.push({ action: "key", key: String(p.keycode) });
        break;
      }
      case "scroll": {
        const p = act.params as { x: number; y: number; scrollV: number; scrollH: number };
        // Scroll as a short swipe in the scroll direction
        const scrollDistance = 15;
        batch.push({
          action: "swipe",
          startX: p.x,
          startY: p.y,
          endX: p.x,
          endY: p.y + (p.scrollV > 0 ? -scrollDistance : scrollDistance),
          durationMs: 200,
        });
        break;
      }
    }
  }

  return batch;
}

/**
 * Build a MacroSession from recorded actions.
 */
export function buildMacroSession(
  name: string,
  description: string,
  actions: RecordedAction[],
  startTime: number,
): MacroSession {
  const duration = actions.length > 0
    ? actions[actions.length - 1]!.timestamp
    : 0;

  return {
    version: 1,
    name,
    description,
    recordedAt: new Date(startTime).toISOString(),
    duration,
    actions,
  };
}

/**
 * Format MCP batch as a copyable JSON string.
 */
export function formatBatchForClipboard(actions: RecordedAction[]): string {
  const batch = toMcpBatch(actions);
  return JSON.stringify(batch, null, 2);
}

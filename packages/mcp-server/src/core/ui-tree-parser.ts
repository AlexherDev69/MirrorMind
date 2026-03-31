/**
 * Shared UI tree parser for Android uiautomator XML dumps.
 * Used by ui-tree.tool.ts and batch.tool.ts.
 */

export interface ParsedUiNode {
  readonly className: string;
  readonly text: string;
  readonly contentDesc: string;
  readonly resourceId: string;
  readonly clickable: boolean;
  readonly centerX: number; // percentage
  readonly centerY: number; // percentage
}

function extractAttr(attrs: string, name: string): string {
  const regex = new RegExp(`${name}="([^"]*)"`, "i");
  const match = regex.exec(attrs);
  return match?.[1] ?? "";
}

/**
 * Parse Android uiautomator XML into a list of simplified UI nodes.
 * Coordinates are returned as percentages (0-100).
 */
export function parseUiTree(xml: string, screenWidth: number, screenHeight: number): ParsedUiNode[] {
  const nodes: ParsedUiNode[] = [];
  const nodeRegex = /<node\s+([^>]+?)\/?>|<node\s+([^>]+?)>/g;
  let match;

  while ((match = nodeRegex.exec(xml)) !== null) {
    const attrs = match[1] ?? match[2] ?? "";

    const text = extractAttr(attrs, "text");
    const contentDesc = extractAttr(attrs, "content-desc");
    const resourceId = extractAttr(attrs, "resource-id");
    const className = extractAttr(attrs, "class");
    const clickable = extractAttr(attrs, "clickable") === "true";
    const boundsStr = extractAttr(attrs, "bounds");

    if (!text && !contentDesc && !clickable) continue;

    const boundsMatch = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(boundsStr);
    if (!boundsMatch) continue;

    const x1 = parseInt(boundsMatch[1]!, 10);
    const y1 = parseInt(boundsMatch[2]!, 10);
    const x2 = parseInt(boundsMatch[3]!, 10);
    const y2 = parseInt(boundsMatch[4]!, 10);

    const centerX = Math.round(((x1 + x2) / 2 / screenWidth) * 100);
    const centerY = Math.round(((y1 + y2) / 2 / screenHeight) * 100);

    nodes.push({
      className: className.split(".").pop() ?? className,
      text,
      contentDesc,
      resourceId: resourceId.split("/").pop() ?? resourceId,
      clickable,
      centerX,
      centerY,
    });
  }

  return nodes;
}

/**
 * Format UI nodes as readable text for Claude.
 */
export function formatUiTree(nodes: ParsedUiNode[]): string {
  return nodes.map((n) => {
    const parts: string[] = [];
    parts.push(`[${n.className}]`);
    if (n.text) parts.push(`text="${n.text}"`);
    if (n.contentDesc) parts.push(`desc="${n.contentDesc}"`);
    if (n.resourceId) parts.push(`id="${n.resourceId}"`);
    if (n.clickable) parts.push("(clickable)");
    parts.push(`at (${n.centerX}%, ${n.centerY}%)`);
    return parts.join(" ");
  }).join("\n");
}

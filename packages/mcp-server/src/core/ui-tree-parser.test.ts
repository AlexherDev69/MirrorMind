import { describe, it, expect } from "vitest";
import { parseUiTree, formatUiTree } from "./ui-tree-parser.js";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.test" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][1080,2400]">
    <node index="0" text="Hello World" resource-id="com.test:id/title" class="android.widget.TextView" content-desc="" clickable="true" bounds="[50,100][300,150]" />
    <node index="1" text="" resource-id="com.test:id/btn" class="android.widget.Button" content-desc="Submit form" clickable="true" bounds="[100,500][400,600]" />
    <node index="2" text="" resource-id="" class="android.view.View" content-desc="" clickable="false" bounds="[0,0][100,100]" />
  </node>
</hierarchy>`;

describe("parseUiTree", () => {
  it("should parse XML nodes with text", () => {
    const nodes = parseUiTree(SAMPLE_XML, 1080, 2400);
    const textNode = nodes.find((n) => n.text === "Hello World");
    expect(textNode).toBeDefined();
    expect(textNode!.className).toBe("TextView");
    expect(textNode!.resourceId).toBe("title");
    expect(textNode!.clickable).toBe(true);
  });

  it("should parse nodes with content-desc", () => {
    const nodes = parseUiTree(SAMPLE_XML, 1080, 2400);
    const btnNode = nodes.find((n) => n.contentDesc === "Submit form");
    expect(btnNode).toBeDefined();
    expect(btnNode!.className).toBe("Button");
    expect(btnNode!.resourceId).toBe("btn");
  });

  it("should skip nodes without text, desc, or clickable", () => {
    const nodes = parseUiTree(SAMPLE_XML, 1080, 2400);
    // The View with no text/desc and clickable=false should be skipped
    // But the FrameLayout is also clickable=false and no text — also skipped
    const viewNode = nodes.find((n) => n.className === "View");
    expect(viewNode).toBeUndefined();
  });

  it("should calculate center coordinates as percentages", () => {
    const nodes = parseUiTree(SAMPLE_XML, 1080, 2400);
    const textNode = nodes.find((n) => n.text === "Hello World")!;
    // bounds [50,100][300,150] → center = (175, 125) → % of 1080x2400
    expect(textNode.centerX).toBe(Math.round((175 / 1080) * 100)); // ~16
    expect(textNode.centerY).toBe(Math.round((125 / 2400) * 100)); // ~5
  });

  it("should return empty array for empty XML", () => {
    expect(parseUiTree("", 1080, 2400)).toEqual([]);
    expect(parseUiTree("<hierarchy></hierarchy>", 1080, 2400)).toEqual([]);
  });

  it("should handle XML with special characters in text", () => {
    const xml = `<node text="Hello &amp; World" class="TextView" content-desc="" resource-id="" clickable="true" bounds="[0,0][100,100]" />`;
    const nodes = parseUiTree(xml, 1080, 2400);
    expect(nodes.length).toBe(1);
    expect(nodes[0]!.text).toBe("Hello &amp; World");
  });
});

describe("formatUiTree", () => {
  it("should format nodes as readable text", () => {
    const nodes = parseUiTree(SAMPLE_XML, 1080, 2400);
    const formatted = formatUiTree(nodes);
    expect(formatted).toContain('[TextView] text="Hello World"');
    expect(formatted).toContain('[Button] desc="Submit form"');
    expect(formatted).toContain("(clickable)");
    expect(formatted).toContain("at (");
  });

  it("should handle empty array", () => {
    expect(formatUiTree([])).toBe("");
  });
});

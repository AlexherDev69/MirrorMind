import { describe, it, expect } from "vitest";
import { resolveDeepLink, DEEP_LINKS_DB } from "./deep-links.js";

describe("resolveDeepLink", () => {
  it("should resolve known shorthands", () => {
    expect(resolveDeepLink("instagram:direct")).toBe("instagram://direct");
    expect(resolveDeepLink("spotify:search")).toBe("spotify://search");
    expect(resolveDeepLink("settings:wifi")).toBe("android.settings://WIFI_SETTINGS");
  });

  it("should resolve shorthands with parameters", () => {
    expect(resolveDeepLink("whatsapp:send:33612345678")).toBe("whatsapp://send?phone=33612345678");
    expect(resolveDeepLink("youtube:video:dQw4w9WgXcQ")).toBe("youtube://watch?v=dQw4w9WgXcQ");
  });

  it("should pass through raw URIs", () => {
    expect(resolveDeepLink("https://example.com")).toBe("https://example.com");
    expect(resolveDeepLink("tel:0612345678")).toBe("tel:0612345678");
    expect(resolveDeepLink("custom://something")).toBe("custom://something");
  });

  it("should return null for unknown shorthands", () => {
    expect(resolveDeepLink("unknown:action")).toBeNull();
    expect(resolveDeepLink("x")).toBeNull();
  });

  it("should be case-insensitive for app names", () => {
    expect(resolveDeepLink("Instagram:direct")).toBe("instagram://direct");
    expect(resolveDeepLink("SPOTIFY:search")).toBe("spotify://search");
  });

  it("should have at least 20 apps in the DB", () => {
    expect(Object.keys(DEEP_LINKS_DB).length).toBeGreaterThanOrEqual(20);
  });

  it("should have valid URIs for all links", () => {
    for (const [, app] of Object.entries(DEEP_LINKS_DB)) {
      for (const [, uri] of Object.entries(app.links)) {
        expect(uri).toMatch(/^[a-z][\w.-]*:\/?\/?/i);
      }
    }
  });
});

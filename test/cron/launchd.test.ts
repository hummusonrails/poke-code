import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generatePlist, PLIST_LABEL } from "../../src/cron/launchd.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "launchd");

describe("launchd", () => {
  beforeEach(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("generates a valid plist with correct label", () => {
    const plist = generatePlist("/usr/local/bin/poke-code", "/Users/test/.poke/daemon.log");
    expect(plist).toContain(`<string>${PLIST_LABEL}</string>`);
    expect(plist).toContain("<string>/usr/local/bin/poke-code</string>");
    expect(plist).toContain("<string>--daemon</string>");
    expect(plist).toContain("<string>start</string>");
    expect(plist).toContain("<true/>");
    expect(plist).toContain("/Users/test/.poke/daemon.log");
  });

  it("PLIST_LABEL is com.poke-code.daemon", () => {
    expect(PLIST_LABEL).toBe("com.poke-code.daemon");
  });
});

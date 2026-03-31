import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigStore } from "../../src/config/store.js";
import { DEFAULT_CONFIG } from "../../src/types.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "store");

function tempDir(suffix: string): string {
  const dir = join(FIXTURES_DIR, suffix);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function _cleanup(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

describe("ConfigStore", () => {
  beforeEach(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", () => {
    const dir = tempDir("no-file");
    const store = new ConfigStore(dir);
    const config = store.load();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("saves and loads config", () => {
    const dir = tempDir("save-load");
    const store = new ConfigStore(dir);
    const config = { ...DEFAULT_CONFIG, apiKey: "test-key-123", vimMode: true };
    store.save(config);
    const loaded = store.load();
    expect(loaded.apiKey).toBe("test-key-123");
    expect(loaded.vimMode).toBe(true);
  });

  it("creates directory if it does not exist", () => {
    const dir = join(FIXTURES_DIR, "new-dir", "nested");
    const store = new ConfigStore(dir);
    store.save(DEFAULT_CONFIG);
    const loaded = store.load();
    expect(loaded).toEqual(DEFAULT_CONFIG);
    rmSync(join(FIXTURES_DIR, "new-dir"), { recursive: true, force: true });
  });

  it("merges partial updates over existing config", () => {
    const dir = tempDir("partial-update");
    const store = new ConfigStore(dir);
    store.save({ ...DEFAULT_CONFIG, apiKey: "original", theme: "dark" });
    store.update({ theme: "light" });
    const loaded = store.load();
    expect(loaded.apiKey).toBe("original");
    expect(loaded.theme).toBe("light");
  });

  it("throws ConfigError when config file is corrupt", () => {
    const dir = tempDir("corrupt");
    writeFileSync(join(dir, "config.json"), "not valid json", "utf-8");
    const store = new ConfigStore(dir);
    expect(() => store.load()).toThrow("Failed to parse config:");
  });

  it("resolves api key from config file", () => {
    const dir = tempDir("resolve-from-file");
    const store = new ConfigStore(dir);
    store.save({ ...DEFAULT_CONFIG, apiKey: "file-key" });
    delete process.env.POKE_API_KEY;
    expect(store.resolveApiKey()).toBe("file-key");
  });

  it("prefers env var POKE_API_KEY over config file", () => {
    const dir = tempDir("prefer-env");
    const store = new ConfigStore(dir);
    store.save({ ...DEFAULT_CONFIG, apiKey: "file-key" });
    process.env.POKE_API_KEY = "env-key";
    expect(store.resolveApiKey()).toBe("env-key");
    delete process.env.POKE_API_KEY;
  });

  it("returns undefined when no api key set anywhere", () => {
    const dir = tempDir("no-key");
    const store = new ConfigStore(dir);
    delete process.env.POKE_API_KEY;
    expect(store.resolveApiKey()).toBeUndefined();
  });

  it("getConfigDir returns the config directory", () => {
    const dir = tempDir("get-dir");
    const store = new ConfigStore(dir);
    expect(store.getConfigDir()).toBe(dir);
  });

  it("loads autoDream config with defaults", () => {
    const dir = tempDir("autodream-defaults");
    const store = new ConfigStore(dir);
    const config = store.load();
    expect(config.autoDream).toEqual({ enabled: true, minHours: 24, minSessions: 5 });
  });

  it("merges partial autoDream config", () => {
    const dir = tempDir("autodream-partial");
    const store = new ConfigStore(dir);
    store.save({ ...DEFAULT_CONFIG, autoDream: { enabled: false, minHours: 12, minSessions: 3 } });
    const loaded = store.load();
    expect(loaded.autoDream.enabled).toBe(false);
    expect(loaded.autoDream.minHours).toBe(12);
    expect(loaded.autoDream.minSessions).toBe(3);
  });
});

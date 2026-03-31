import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PokeConfig } from "../types.js";
import { DEFAULT_CONFIG } from "../types.js";

export class ConfigStore {
  private configDir: string;
  private configPath: string;

  constructor(configDir: string) {
    this.configDir = configDir;
    this.configPath = join(configDir, "config.json");
  }

  load(): PokeConfig {
    if (!existsSync(this.configPath)) return { ...DEFAULT_CONFIG };
    try {
      const raw = readFileSync(this.configPath, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  save(config: PokeConfig): void {
    mkdirSync(this.configDir, { recursive: true });
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  update(partial: Partial<PokeConfig>): void {
    this.save({ ...this.load(), ...partial });
  }

  resolveApiKey(): string | undefined {
    return process.env.POKE_API_KEY ?? this.load().apiKey;
  }

  getConfigDir(): string {
    return this.configDir;
  }
}

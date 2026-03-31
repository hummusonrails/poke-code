import { cpSync, existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

export function copyClaudeConfig(claudeDir: string, pokeDir: string): void {
  if (!existsSync(claudeDir)) return;
  if (existsSync(pokeDir)) return; // Don't overwrite
  cpSync(claudeDir, pokeDir, { recursive: true });
  renameClaudeToPokeFiles(pokeDir);
}

export function renameClaudeToPokeFiles(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      renameClaudeToPokeFiles(fullPath);
    } else if (entry === "CLAUDE.md") {
      renameSync(fullPath, join(dir, "POKE.md"));
    }
  }
}

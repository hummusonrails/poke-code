import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const PLIST_LABEL = "com.poke-code.daemon";

export function getPlistPath(): string {
  return join(homedir(), "Library", "LaunchAgents", `${PLIST_LABEL}.plist`);
}

export function generatePlist(binPath: string, logPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${binPath}</string>
    <string>--daemon</string>
    <string>start</string>
  </array>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
</dict>
</plist>`;
}

export function installLaunchd(binPath: string, logPath: string): string {
  const plistPath = getPlistPath();
  mkdirSync(dirname(plistPath), { recursive: true });
  writeFileSync(plistPath, generatePlist(binPath, logPath), "utf-8");
  try {
    execFileSync("launchctl", ["load", plistPath], { timeout: 10000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Plist written to ${plistPath} but launchctl load failed: ${msg}`;
  }
  return `Installed and loaded: ${plistPath}\nThe daemon will start automatically on login.`;
}

export function uninstallLaunchd(): string {
  const plistPath = getPlistPath();
  if (!existsSync(plistPath)) {
    return "No launchd plist found. Nothing to uninstall.";
  }
  try {
    execFileSync("launchctl", ["unload", plistPath], { timeout: 10000 });
  } catch {
    /* may not be loaded */
  }
  unlinkSync(plistPath);
  return `Unloaded and removed: ${plistPath}`;
}

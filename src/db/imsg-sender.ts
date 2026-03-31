import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Send a message via imsg CLI directly to iMessage.
 * Bypasses the Poke API — useful for sending tool results
 * which can be large and may get truncated by the API.
 */
export async function imsgSend(chatId: number, text: string): Promise<void> {
  try {
    await execFileAsync("imsg", ["send", "--chat-id", String(chatId), "--text", text], { timeout: 30_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`imsg send failed: ${msg}`);
  }
}

/**
 * Check if imsg send is working by verifying the binary exists.
 */
export async function canImsgSend(): Promise<boolean> {
  try {
    await execFileAsync("imsg", ["--version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

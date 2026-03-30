import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface BashParams {
  command: string;
  timeout?: number;
}

export async function bashTool(params: BashParams): Promise<string> {
  const timeout = params.timeout ?? 120_000;
  try {
    const { stdout, stderr } = await execAsync(params.command, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      shell: '/bin/zsh',
    });
    const output = [stdout, stderr].filter(Boolean).join('\n');
    return output || '(no output)';
  } catch (err: unknown) {
    const error = err as { code?: number; killed?: boolean; stdout?: string; stderr?: string };
    if (error.killed) {
      throw new Error(`Command timed out after ${timeout}ms`);
    }
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n');
    throw new Error(`Command exited with exit code ${error.code ?? 'unknown'}\n${output}`);
  }
}

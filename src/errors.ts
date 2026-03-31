export class PokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PokeError";
  }
}

export class ToolError extends PokeError {
  readonly toolName: string;
  readonly params: Record<string, unknown>;

  constructor(message: string, toolName: string, params: Record<string, unknown>) {
    super(message);
    this.name = "ToolError";
    this.toolName = toolName;
    this.params = params;
  }
}

export class ApiError extends PokeError {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export class ConfigError extends PokeError {
  readonly configPath: string;

  constructor(message: string, configPath: string) {
    super(message);
    this.name = "ConfigError";
    this.configPath = configPath;
  }
}

export class ShellError extends PokeError {
  readonly command: string;
  readonly exitCode: number;

  constructor(message: string, command: string, exitCode: number) {
    super(message);
    this.name = "ShellError";
    this.command = command;
    this.exitCode = exitCode;
  }
}

export class PermissionError extends PokeError {
  readonly toolName: string;
  readonly mode: string;

  constructor(message: string, toolName: string, mode: string) {
    super(message);
    this.name = "PermissionError";
    this.toolName = toolName;
    this.mode = mode;
  }
}

export class AbortError extends PokeError {
  constructor(message = "Operation aborted") {
    super(message);
    this.name = "AbortError";
  }
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof AbortError) return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

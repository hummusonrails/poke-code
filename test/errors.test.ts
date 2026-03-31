import { describe, it, expect } from 'vitest';
import {
  PokeError,
  ToolError,
  ApiError,
  ConfigError,
  AbortError,
  ShellError,
  PermissionError,
  isAbortError,
} from '../src/errors.js';

describe('PokeError', () => {
  it('is instanceof Error', () => {
    const err = new PokeError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PokeError);
    expect(err.message).toBe('test');
    expect(err.name).toBe('PokeError');
  });
});

describe('ToolError', () => {
  it('carries tool name and params', () => {
    const err = new ToolError('file not found', 'read_file', { path: '/foo' });
    expect(err).toBeInstanceOf(PokeError);
    expect(err.toolName).toBe('read_file');
    expect(err.params).toEqual({ path: '/foo' });
    expect(err.name).toBe('ToolError');
  });
});

describe('ApiError', () => {
  it('carries status code', () => {
    const err = new ApiError('rate limited', 429);
    expect(err).toBeInstanceOf(PokeError);
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe('ApiError');
  });
});

describe('ConfigError', () => {
  it('carries config path', () => {
    const err = new ConfigError('parse failed', '/home/.poke/config.json');
    expect(err).toBeInstanceOf(PokeError);
    expect(err.configPath).toBe('/home/.poke/config.json');
  });
});

describe('ShellError', () => {
  it('carries exit code and command', () => {
    const err = new ShellError('exit 1', 'ls /nope', 1);
    expect(err).toBeInstanceOf(PokeError);
    expect(err.command).toBe('ls /nope');
    expect(err.exitCode).toBe(1);
  });
});

describe('PermissionError', () => {
  it('carries tool and mode', () => {
    const err = new PermissionError('denied', 'bash', 'readonly');
    expect(err).toBeInstanceOf(PokeError);
    expect(err.toolName).toBe('bash');
    expect(err.mode).toBe('readonly');
  });
});

describe('AbortError', () => {
  it('is identifiable via isAbortError', () => {
    const err = new AbortError();
    expect(isAbortError(err)).toBe(true);
  });

  it('detects abort-shaped errors by name', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(isAbortError(err)).toBe(true);
  });

  it('returns false for non-abort errors', () => {
    expect(isAbortError(new Error('nope'))).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { StartupProfiler, parallelStartup } from '../src/startup.js';

describe('StartupProfiler', () => {
  it('records checkpoints and returns timings', () => {
    const profiler = new StartupProfiler();
    profiler.checkpoint('init');
    profiler.checkpoint('config');
    profiler.checkpoint('done');
    const timings = profiler.getTimings();
    expect(timings).toHaveLength(3);
    expect(timings[0].label).toBe('init');
    expect(timings[1].label).toBe('config');
    expect(typeof timings[0].elapsed).toBe('number');
  });

  it('formats summary string', () => {
    const profiler = new StartupProfiler();
    profiler.checkpoint('init');
    profiler.checkpoint('done');
    const summary = profiler.summary();
    expect(summary).toContain('init');
    expect(summary).toContain('done');
  });
});

describe('parallelStartup', () => {
  it('runs tasks concurrently and returns results', async () => {
    const results = await parallelStartup({
      configLoaded: async () => ({ key: 'value' }),
      skillsDiscovered: async () => ['skill1', 'skill2'],
    });
    expect(results.configLoaded).toEqual({ key: 'value' });
    expect(results.skillsDiscovered).toEqual(['skill1', 'skill2']);
  });

  it('handles individual task failures gracefully', async () => {
    const results = await parallelStartup({
      good: async () => 'ok',
      bad: async () => { throw new Error('boom'); },
    });
    expect(results.good).toBe('ok');
    expect(results.bad).toBeNull();
  });
});

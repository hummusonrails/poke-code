import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// We can't easily test discoverSkills() since it reads ~/.claude/skills/
// Instead test the parsing and matching functions
// Export them for testing or test through the public API

describe('skills', () => {
  // Test the parsing logic by creating temp skill files
  const FIXTURES_DIR = join(import.meta.dirname, '__fixtures__', 'skills');

  beforeAll(() => {
    mkdirSync(join(FIXTURES_DIR, 'test-skill'), { recursive: true });
    writeFileSync(join(FIXTURES_DIR, 'test-skill', 'SKILL.md'), `---
name: test-skill
description: A test skill for writing tests
---

# Test Skill

This skill helps write tests.
`);

    mkdirSync(join(FIXTURES_DIR, 'deploy-skill'), { recursive: true });
    writeFileSync(join(FIXTURES_DIR, 'deploy-skill', 'SKILL.md'), `---
name: deploy-skill
description: Deploy applications to production
---

# Deploy Skill

This skill helps deploy apps.
`);

    mkdirSync(join(FIXTURES_DIR, 'no-frontmatter'), { recursive: true });
    writeFileSync(join(FIXTURES_DIR, 'no-frontmatter', 'SKILL.md'), `Just some content without frontmatter.`);
  });

  afterAll(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it('discovers skills from a directory', async () => {
    // Import and test with custom path
    const { discoverSkillsFrom } = await import('../../src/context/skills.js');
    const skills = discoverSkillsFrom(FIXTURES_DIR);
    expect(skills.length).toBeGreaterThanOrEqual(2);
    expect(skills.some(s => s.name === 'test-skill')).toBe(true);
    expect(skills.some(s => s.name === 'deploy-skill')).toBe(true);
  });

  it('parses frontmatter correctly', async () => {
    const { discoverSkillsFrom } = await import('../../src/context/skills.js');
    const skills = discoverSkillsFrom(FIXTURES_DIR);
    const testSkill = skills.find(s => s.name === 'test-skill');
    expect(testSkill).toBeDefined();
    expect(testSkill!.description).toBe('A test skill for writing tests');
    expect(testSkill!.content).toContain('This skill helps write tests');
  });

  it('handles missing frontmatter gracefully', async () => {
    const { discoverSkillsFrom } = await import('../../src/context/skills.js');
    const skills = discoverSkillsFrom(FIXTURES_DIR);
    const noFm = skills.find(s => s.name === 'no-frontmatter');
    expect(noFm).toBeDefined();
    expect(noFm!.content).toContain('Just some content');
  });

  it('finds relevant skills by keyword', async () => {
    const { discoverSkillsFrom, findRelevantSkills } = await import('../../src/context/skills.js');
    const skills = discoverSkillsFrom(FIXTURES_DIR);

    const relevant = findRelevantSkills('help me write some tests', skills);
    expect(relevant.some(s => s.name === 'test-skill')).toBe(true);

    const deployRelevant = findRelevantSkills('deploy this to production', skills);
    expect(deployRelevant.some(s => s.name === 'deploy-skill')).toBe(true);
  });

  it('returns empty for no matches', async () => {
    const { discoverSkillsFrom, findRelevantSkills } = await import('../../src/context/skills.js');
    const skills = discoverSkillsFrom(FIXTURES_DIR);

    const relevant = findRelevantSkills('hi', skills);
    expect(relevant).toEqual([]);
  });

  it('formats skills context', async () => {
    const { formatSkillsContext } = await import('../../src/context/skills.js');
    const result = formatSkillsContext([
      { name: 'my-skill', description: 'Does stuff', content: '# Usage\nDo the thing.', path: '/tmp/x' },
    ]);
    expect(result).toContain('## Available Skills');
    expect(result).toContain('### my-skill');
    expect(result).toContain('Does stuff');
    expect(result).toContain('Do the thing');
  });
});

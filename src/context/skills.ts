import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface Skill {
  name: string;
  description: string;
  content: string;
  path: string;
}

/**
 * Discover all skills from multiple Claude directories:
 * - ~/.claude/skills/ (user custom skills)
 * - ~/.claude/plugins/marketplaces/.../skills/ (marketplace plugin skills)
 */
export function discoverSkills(): Skill[] {
  const home = homedir();
  // Check for custom skills directories in poke config
  const configPath = join(home, '.poke', 'config.json');
  let extraDirs: string[] = [];
  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (Array.isArray(config.skillsDirs)) {
        extraDirs = config.skillsDirs;
      } else if (typeof config.skillsDir === 'string') {
        extraDirs = [config.skillsDir];
      }
    }
  } catch { /* ignore config parse errors */ }

  const dirs = [
    join(home, '.claude', 'skills'),
    ...extraDirs,
  ];

  // Scan marketplace plugins for skills
  const marketplacesDir = join(home, '.claude', 'plugins', 'marketplaces');
  if (existsSync(marketplacesDir)) {
    try {
      scanForSkillDirs(marketplacesDir, dirs, 5);
    } catch {
      // ignore scan errors
    }
  }

  const allSkills: Skill[] = [];
  const seen = new Set<string>();
  for (const dir of dirs) {
    for (const skill of discoverSkillsFrom(dir)) {
      if (!seen.has(skill.name)) {
        seen.add(skill.name);
        allSkills.push(skill);
      }
    }
  }
  return allSkills;
}

/**
 * Recursively find directories named "skills" containing SKILL.md files.
 */
function scanForSkillDirs(dir: string, results: string[], maxDepth: number): void {
  if (maxDepth <= 0) return;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(dir, entry.name);
      if (entry.name === 'skills') {
        results.push(fullPath);
      } else if (entry.name !== 'node_modules' && entry.name !== '.git') {
        scanForSkillDirs(fullPath, results, maxDepth - 1);
      }
    }
  } catch {
    // permission errors, etc.
  }
}

/**
 * Discover skills from a custom directory (useful for testing).
 */
export function discoverSkillsFrom(skillsDir: string): Skill[] {
  if (!existsSync(skillsDir)) return [];

  const skills: Skill[] = [];

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillPath)) continue;

      try {
        const raw = readFileSync(skillPath, 'utf-8');
        const parsed = parseSkillFrontmatter(raw);
        skills.push({
          name: parsed.name || entry.name,
          description: parsed.description || '',
          content: parsed.content,
          path: skillPath,
        });
      } catch {
        // Skip unreadable skills
      }
    }
  } catch {
    // Skills dir not readable
  }

  return skills;
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Format:
 * ---
 * name: skill-name
 * description: what it does
 * ---
 * content here
 */
function parseSkillFrontmatter(raw: string): { name: string; description: string; content: string } {
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { name: '', description: '', content: raw };
  }

  const frontmatter = frontmatterMatch[1];
  const content = frontmatterMatch[2].trim();

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch?.[1]?.trim() ?? '',
    description: descMatch?.[1]?.trim() ?? '',
    content,
  };
}

/**
 * Find skills relevant to a user message based on keyword matching.
 * Returns skills whose name or description contains words from the message.
 */
export function findRelevantSkills(message: string, skills: Skill[], maxSkills = 3): Skill[] {
  if (skills.length === 0) return [];

  const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return [];

  const scored = skills.map(skill => {
    const searchText = `${skill.name} ${skill.description} ${skill.content.slice(0, 500)}`.toLowerCase();
    const matches = words.filter(w => searchText.includes(w)).length;
    return { skill, score: matches };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSkills)
    .map(s => s.skill);
}

/**
 * Format skills for inclusion in the context.
 */
export function formatSkillsContext(skills: Skill[]): string {
  if (skills.length === 0) return '';

  const sections = skills.map(s => {
    // Truncate very long skills to avoid blowing up context
    const truncated = s.content.length > 2000
      ? s.content.slice(0, 2000) + '\n... (truncated)'
      : s.content;
    return `### ${s.name}\n${s.description ? `*${s.description}*\n\n` : ''}${truncated}`;
  });

  return `## Available Skills\n\n${sections.join('\n\n---\n\n')}`;
}

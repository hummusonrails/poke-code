import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SessionEntry, SessionMeta } from '../types.js';

export class SessionManager {
  private sessionsDir: string;
  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
    mkdirSync(sessionsDir, { recursive: true });
  }

  create(cwd: string, label?: string): SessionMeta {
    const meta: SessionMeta = { id: randomUUID(), startedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), messageCount: 0, cwd, label };
    writeFileSync(join(this.sessionsDir, `${meta.id}.jsonl`), '', 'utf-8');
    const index = this.loadIndex();
    index.push(meta);
    this.saveIndex(index);
    return meta;
  }

  append(sessionId: string, entry: SessionEntry): void {
    appendFileSync(join(this.sessionsDir, `${sessionId}.jsonl`), JSON.stringify(entry) + '\n', 'utf-8');
    const index = this.loadIndex();
    const meta = index.find(s => s.id === sessionId);
    if (meta) { meta.lastActiveAt = new Date().toISOString(); meta.messageCount++; this.saveIndex(index); }
  }

  list(): SessionMeta[] {
    return this.loadIndex().sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  loadEntries(sessionId: string): SessionEntry[] {
    const p = join(this.sessionsDir, `${sessionId}.jsonl`);
    if (!existsSync(p)) return [];
    const raw = readFileSync(p, 'utf-8').trim();
    if (!raw) return [];
    return raw.split('\n').map(line => JSON.parse(line));
  }

  getMostRecent(): SessionMeta | null {
    const sessions = this.list();
    return sessions.length > 0 ? sessions[0] : null;
  }

  getSession(sessionId: string): SessionMeta | undefined {
    return this.loadIndex().find(s => s.id === sessionId);
  }

  private loadIndex(): SessionMeta[] {
    const p = join(this.sessionsDir, 'index.json');
    if (!existsSync(p)) return [];
    try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return []; }
  }

  private saveIndex(index: SessionMeta[]): void {
    writeFileSync(join(this.sessionsDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  }
}

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skills = readdirSync('.claude/skills');
const bodies = Object.fromEntries(
  skills.map((name) => [name, readFileSync(`.claude/skills/${name}/SKILL.md`, 'utf8')])
);
const configSource = readFileSync('src/config.ts', 'utf8');
const allProse = [readFileSync('CLAUDE.md', 'utf8'), ...Object.values(bodies)].join('\n');

describe('the Claude Code layer', () => {
  it('ships the four skills the setup flow needs', () => {
    expect(skills.sort()).toEqual(['deploy', 'doctor', 'knowledge', 'setup']);
  });

  it('gives every skill a name and description frontmatter block', () => {
    for (const [name, body] of Object.entries(bodies)) {
      expect(body, name).toMatch(/^---\nname: /);
      expect(body, name).toContain('description:');
    }
  });

  // Named because the docs deliberately mention it to tell people it is gone.
  // Anyone arriving from the version this replaced will go looking for it.
  const REMOVED = ['BUSINESS_CONTEXT'];

  it('names only environment variables the config actually reads', () => {
    const mentioned = new Set(allProse.match(/\b[A-Z][A-Z0-9_]{5,}\b/g) ?? []);
    for (const token of mentioned) {
      if (!token.includes('_') || REMOVED.includes(token)) continue;
      expect(configSource, `${token} is documented but not read by config.ts`).toContain(token);
    }
  });

  it('mentions a removed variable only to say it is gone', () => {
    for (const name of REMOVED) {
      expect(configSource, `${name} is listed as removed but config.ts still reads it`).not.toContain(name);
      for (const line of allProse.split('\n').filter((l) => l.includes(name))) {
        expect(line, `${name} is mentioned without saying it no longer exists`)
          .toMatch(/no |not |removed|gone|instead/i);
      }
    }
  });

  it('never tells anyone to paste a secret into a chat message', () => {
    expect(allProse.toLowerCase()).not.toMatch(/paste (your|the) (app secret|access token|service role key) here/);
  });

  it('follows the prose rules for this repo', () => {
    expect(allProse).not.toMatch(/[—–]/);
    expect(allProse).not.toMatch(/^- \*\*[^*]+:\*\*/m);
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docs = readdirSync('docs').filter((f) => f.endsWith('.md'));
const readme = readFileSync('README.md', 'utf8');
const allProse = [readme, ...docs.map((f) => readFileSync(`docs/${f}`, 'utf8'))].join('\n');
const envExample = readFileSync('.env.example', 'utf8');
const configSource = readFileSync('src/config.ts', 'utf8');

describe('documentation', () => {
  it('ships the pages the setup skill links to', () => {
    for (const page of [
      'meta-setup.md', 'deploy-vps.md', 'voice.md',
      'company-brain.md', 'troubleshooting.md', 'skool-guide.md'
    ]) {
      expect(docs).toContain(page);
    }
  });

  it('states the 24 hour window in the readme', () => {
    expect(readme).toContain('24 hours');
  });

  it('warns that production needs business verification', () => {
    expect(allProse.toLowerCase()).toContain('business verification');
  });

  it('quotes no pricing figure, since prices vary by country and go stale', () => {
    expect(allProse).not.toMatch(/\$\d/);
  });

  it('links a pricing page wherever it talks about cost', () => {
    expect(readme).toContain('pricing');
    expect(readme).toMatch(/https:\/\/\S*pricing/);
  });

  it('follows the prose rules for this repo', () => {
    expect(allProse).not.toMatch(/[—–]/);
    expect(allProse).not.toMatch(/^- \*\*[^*]+:\*\*/m);
  });

  it('documents every variable the config reads, and no others', () => {
    const declared = [...configSource.matchAll(/^  ([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(10);
    for (const name of declared) {
      expect(envExample, `${name} is read by config.ts but missing from .env.example`).toContain(name);
    }
    const documented = [...envExample.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]);
    for (const name of documented) {
      expect(declared, `${name} is in .env.example but not read by config.ts`).toContain(name);
    }
  });

  it('does not resurrect BUSINESS_CONTEXT as something to set', () => {
    expect(envExample).not.toMatch(/^BUSINESS_CONTEXT=/m);
  });
});

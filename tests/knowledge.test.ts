import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { estimateTokens, fileKnowledge, KnowledgeBudgetError } from '../src/knowledge/files.js';

function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'knowledge-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('estimateTokens', () => {
  it('counts roughly four characters per token', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('fileKnowledge', () => {
  it('concatenates markdown files in filename order with their names as headings', async () => {
    const dir = fixture({ '02-prices.md': 'Haircut is 20.', '01-what.md': 'We cut hair.' });
    const text = await fileKnowledge({ dir, maxTokens: 1000 }).load();
    expect(text.indexOf('01-what.md')).toBeLessThan(text.indexOf('02-prices.md'));
    expect(text).toContain('We cut hair.');
    expect(text).toContain('Haircut is 20.');
  });

  it('ignores files that are not markdown', async () => {
    const dir = fixture({ 'notes.md': 'real knowledge', 'photo.png': 'binary junk' });
    const text = await fileKnowledge({ dir, maxTokens: 1000 }).load();
    expect(text).toContain('real knowledge');
    expect(text).not.toContain('binary junk');
  });

  it('names the file that broke the budget and by how much', async () => {
    const dir = fixture({ 'a.md': 'x'.repeat(400), 'b.md': 'y'.repeat(400) });
    const error = await fileKnowledge({ dir, maxTokens: 150 }).load().catch((e) => e);

    expect(error).toBeInstanceOf(KnowledgeBudgetError);
    // The second file is the one that tipped it over, and that is what the
    // owner needs to be told to trim.
    expect(error.file).toBe('b.md');
    expect(error.maxTokens).toBe(150);
    expect(error.totalTokens).toBeGreaterThan(150);
    expect(error.message).toContain('b.md');
    expect(error.message).toContain('KNOWLEDGE_MAX_TOKENS');
  });

  it('explains what to do when the folder is empty rather than returning nothing', async () => {
    const dir = fixture({});
    await expect(fileKnowledge({ dir, maxTokens: 1000 }).load()).rejects.toThrow(/no markdown files/i);
  });

  it('says which folder is missing rather than throwing a bare ENOENT', async () => {
    const load = fileKnowledge({ dir: join(tmpdir(), 'definitely-not-here'), maxTokens: 1000 }).load();
    await expect(load).rejects.toThrow(/folder not found/i);
  });
});

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { KnowledgeProvider } from './types.js';

export class KnowledgeBudgetError extends Error {
  constructor(
    public readonly file: string,
    public readonly totalTokens: number,
    public readonly maxTokens: number
  ) {
    super(
      `Knowledge budget exceeded. Adding ${file} took the total to ${totalTokens} tokens, ` +
      `over the limit of ${maxTokens}. Trim that file or raise KNOWLEDGE_MAX_TOKENS.`
    );
    this.name = 'KnowledgeBudgetError';
  }
}

/**
 * Four characters per token. Not the model's tokenizer, and it does not need to
 * be: this exists to stop someone pasting a 200 page catalogue into the folder
 * and wondering why every reply costs so much, not to bill anyone.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function fileKnowledge({ dir, maxTokens }: { dir: string; maxTokens: number }): KnowledgeProvider {
  return {
    async load() {
      const entries = await readdir(dir).catch(() => {
        throw new Error(`Knowledge folder not found: ${dir}. Create it and add at least one .md file.`);
      });

      // Sorted so the order is the owner's, set by filename, and never the
      // filesystem's. That is why the examples ship numbered.
      const markdown = entries.filter((name) => name.toLowerCase().endsWith('.md')).sort();

      if (markdown.length === 0) {
        throw new Error(`Found no markdown files in ${dir}. The agent has nothing to tell anyone until you add some.`);
      }

      const parts: string[] = [];
      let total = 0;

      for (const name of markdown) {
        const body = (await readFile(join(dir, name), 'utf8')).trim();
        if (!body) continue;
        const section = `## ${name}\n\n${body}`;
        total += estimateTokens(section);
        if (total > maxTokens) throw new KnowledgeBudgetError(name, total, maxTokens);
        parts.push(section);
      }

      return parts.join('\n\n');
    }
  };
}

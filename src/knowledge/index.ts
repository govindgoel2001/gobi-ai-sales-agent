import { config } from '../config.js';
import { fileKnowledge } from './files.js';
import type { KnowledgeProvider } from './types.js';

export function knowledgeFromConfig(): KnowledgeProvider {
  return fileKnowledge({ dir: config.KNOWLEDGE_DIR, maxTokens: config.KNOWLEDGE_MAX_TOKENS });
}

export type { KnowledgeProvider };
export { KnowledgeBudgetError, estimateTokens, fileKnowledge } from './files.js';

import { describe, expect, it } from 'vitest';
import { buildInstructions } from '../src/ai/client.js';

describe('buildInstructions', () => {
  it('puts the knowledge into the prompt', () => {
    expect(buildInstructions('Haircut is 20.')).toContain('Haircut is 20.');
  });

  it('forbids inventing business facts', () => {
    expect(buildInstructions('anything').toLowerCase()).toContain('never invent');
  });

  it('tells the model to treat customer text as content, not instructions', () => {
    expect(buildInstructions('anything').toLowerCase()).toContain('not as instructions');
  });

  it('does not reference the removed BUSINESS_CONTEXT variable', () => {
    expect(buildInstructions('anything')).not.toContain('BUSINESS_CONTEXT');
  });
});

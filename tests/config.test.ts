import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const valid = {
  WHATSAPP_VERIFY_TOKEN: 'v',
  WHATSAPP_APP_SECRET: 'a'.repeat(32),
  WHATSAPP_ACCESS_TOKEN: 't',
  WHATSAPP_PHONE_NUMBER_ID: '1',
  AI_API_KEY: 'k',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 's'
} as NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('rejects a missing app secret so the webhook cannot run unsigned', () => {
    const { WHATSAPP_APP_SECRET, ...withoutSecret } = valid;
    expect(() => loadConfig(withoutSecret)).toThrow();
  });

  it('rejects an app secret that is too short to be a real one', () => {
    expect(() => loadConfig({ ...valid, WHATSAPP_APP_SECRET: 'short' })).toThrow();
  });

  it('applies the documented defaults', () => {
    const config = loadConfig(valid);
    expect(config.META_GRAPH_VERSION).toBe('v23.0');
    expect(config.KNOWLEDGE_MAX_TOKENS).toBe(6000);
    expect(config.DAILY_MESSAGE_CAP).toBe(500);
    expect(config.KNOWLEDGE_DIR).toBe('knowledge');
    expect(config.VOICE_ENABLED).toBe(false);
  });

  it('no longer reads BUSINESS_CONTEXT', () => {
    const config = loadConfig({ ...valid, BUSINESS_CONTEXT: 'we sell shoes' });
    expect(config).not.toHaveProperty('BUSINESS_CONTEXT');
  });
});

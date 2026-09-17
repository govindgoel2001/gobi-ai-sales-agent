import 'dotenv/config';
import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  PUBLIC_BASE_URL: z.string().url().optional(),

  // Required. verifyMetaSignature has no unsigned path, so a deploy without
  // this must fail at boot rather than serve an open webhook.
  WHATSAPP_APP_SECRET: z.string().min(32),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  META_GRAPH_VERSION: z.string().default('v23.0'),

  AI_API_STYLE: z.enum(['responses', 'chat_completions']).default('responses'),
  AI_API_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().default('gpt-5-mini'),
  BUSINESS_NAME: z.string().default('Your Business'),

  KNOWLEDGE_DIR: z.string().default('knowledge'),
  KNOWLEDGE_MAX_TOKENS: z.coerce.number().int().positive().default(6000),

  // How long the agent stays quiet after handing a contact to a person. It
  // expires on purpose: a handoff that never lifts is a contact the agent is
  // permanently dead for.
  HANDOFF_HOURS: z.coerce.number().positive().default(24),

  DAILY_MESSAGE_CAP: z.coerce.number().int().positive().default(500),
  PER_CONTACT_BURST: z.coerce.number().int().positive().default(5),
  PER_CONTACT_REFILL_MS: z.coerce.number().int().positive().default(60_000),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  VOICE_ENABLED: z.string().default('false').transform((v) => v.toLowerCase() === 'true'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-realtime'),
  OPENAI_REALTIME_VOICE: z.string().default('marin')
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(env);
}

export const config = loadConfig();

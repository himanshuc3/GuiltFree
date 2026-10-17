import dotenv from 'dotenv';
import { z } from 'zod';

// Server runs from apps/server; the shared .env lives at the repo root.
dotenv.config({ path: ['.env', '../../.env'], quiet: true });

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess(emptyToUndefined, s.optional());

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_API_KEY: z.string().min(1).default('dev-api-key'),
  MONGODB_URI: opt(z.string()),
  MONGODB_DB: z.string().default('guiltfree'),
  GMAIL_MODE: z.enum(['mock', 'google']).default('mock'),
  GOOGLE_CLIENT_ID: opt(z.string()),
  GOOGLE_CLIENT_SECRET: opt(z.string()),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:3000/auth/google/callback'),
  LLM_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  LLM_API_KEY: opt(z.string()),
  LLM_MODEL: z.string().default('google/gemma-3-27b-it'),
  TRACKING_SINCE: opt(z.string().datetime()),
  MOCK_REBASE_DATES: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SYNC_INTERVAL_SECONDS: z.coerce.number().int().nonnegative().default(120),
  FIXTURES_DIR: opt(z.string()),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = EnvSchema.parse(env);
  if (config.GMAIL_MODE === 'google' && (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET)) {
    throw new Error('GMAIL_MODE=google requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  }
  return config;
}

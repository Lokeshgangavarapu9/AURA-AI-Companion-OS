import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from backend/.env in non-production environments
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/**
 * Zod Schema for strict Environment Variable Validation
 * Enforces correct data types and required fields at startup.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for Prisma DB access'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters long'),
  
  // AI Provider Configuration & API Keys
  ACTIVE_AI_PROVIDER: z.string().optional().default('gemini'),
  ACTIVE_AI_MODEL: z.string().optional().default('gemini-2.5-flash'),
  USE_PROVIDER_ABSTRACTION: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
  
  GEMINI_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  GROQ_API_KEY: z.string().optional().default(''),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  CEREBRAS_API_KEY: z.string().optional().default(''),
  HUGGINGFACE_API_KEY: z.string().optional().default(''),
  TOGETHER_API_KEY: z.string().optional().default(''),

  // AI Generation Settings
  AI_TEMPERATURE: z.coerce.number().optional().default(0.8),
  AI_MAX_TOKENS: z.coerce.number().int().optional().default(4096),
  AI_TIMEOUT_MS: z.coerce.number().int().optional().default(30000),
  AI_MAX_RETRIES: z.coerce.number().int().optional().default(3),
  AI_STREAMING: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),

  // Voice Configuration
  VOICE_STT_PROVIDER: z.string().optional().default('google'),
  VOICE_TTS_PROVIDER: z.string().optional().default('google'),
  VOICE_LANGUAGE: z.string().optional().default('en-US'),
  VOICE_NAME: z.string().optional().default('en-US-Neural2-F'),
  VOICE_RATE: z.coerce.number().optional().default(1.0),
  VOICE_PITCH: z.coerce.number().optional().default(0.0),
  VOICE_VOLUME: z.coerce.number().optional().default(1.0),
  VOICE_AUDIO_FORMAT: z.string().optional().default('MP3'),
  VOICE_INTERIM_RESULTS: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
  VOICE_AUTO_PUNCTUATION: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
  VOICE_CONFIDENCE_THRESHOLD: z.coerce.number().optional().default(0.70),
  VOICE_STREAMING: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
  VOICE_TIMEOUT_MS: z.coerce.number().int().optional().default(30000),

  // Camera / Vision Configuration
  VISION_ENABLED: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
  VISION_PROVIDER: z.string().optional().default('google'),

  // Google Workspace OAuth Configuration
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().optional().default('http://localhost:5000/api/v1/workspace/auth/callback'),

  // Supabase Auth Configuration
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_JWT_SECRET: z.string().optional().default(''),
});

// Parse and validate process.env
const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ FATAL: Environment Variable Validation Error:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment variables. Backend server shutting down.');
  }

  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;

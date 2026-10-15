import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFile = path.join(serverRoot, '.env')

// Tests configure process.env themselves; everywhere else read server/.env if present.
if (process.env.NODE_ENV !== 'test' && fs.existsSync(envFile)) {
  process.loadEnvFile(envFile)
}

const bool = (fallback) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => (value === undefined ? fallback : value === 'true' || value === '1'))

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_DAYS: z.coerce.number().int().min(1).max(30).default(7),

  CLIENT_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: optionalString,
  COOKIE_DOMAIN: optionalString,
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  JSON_BODY_LIMIT: z.string().default('2mb'),

  TRIAL_DAYS: z.coerce.number().int().min(0).max(60).default(7),
  PAYMENT_GRACE_DAYS: z.coerce.number().int().min(0).max(30).default(3),
  ANALYTICS_TIMEZONE: z.string().default('Asia/Kolkata'),

  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  RAZORPAY_PLAN_STARTER: optionalString,
  RAZORPAY_PLAN_PRO: optionalString,
  RAZORPAY_TOTAL_COUNT: z.coerce.number().int().min(1).max(1200).default(120),
  RAZORPAY_API_BASE: z.string().default('https://api.razorpay.com/v1'),

  RATE_LIMIT_ENABLED: bool(true),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  // Print variable names and problems only — never the values, which may be secrets.
  const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')
  const message = `Invalid environment configuration:\n${problems}\nCopy server/.env.example to server/.env and fill in the values.`
  if (process.env.NODE_ENV === 'test') throw new Error(message)
  console.error(message)
  process.exit(1)
}

const env = parsed.data
const isProduction = env.NODE_ENV === 'production'
const cookieSecure = env.COOKIE_SECURE === undefined ? isProduction : env.COOKIE_SECURE === 'true'

if (env.COOKIE_SAMESITE === 'none' && !cookieSecure) {
  console.error('COOKIE_SAMESITE=none requires secure cookies (COOKIE_SECURE=true and HTTPS).')
  process.exit(1)
}
if (isProduction && !cookieSecure) {
  console.error('Refusing to start: cookies must be secure in production (serve the API over HTTPS).')
  process.exit(1)
}

export const config = {
  env: env.NODE_ENV,
  isProduction,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  mongoUri: env.MONGODB_URI,
  jwt: {
    secret: env.JWT_SECRET,
    expiresDays: env.JWT_EXPIRES_DAYS,
  },
  clientOrigins: env.CLIENT_ORIGINS.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  cookies: {
    sameSite: env.COOKIE_SAMESITE,
    secure: cookieSecure,
    domain: env.COOKIE_DOMAIN,
  },
  trustProxy: env.TRUST_PROXY,
  jsonBodyLimit: env.JSON_BODY_LIMIT,
  trialDays: env.TRIAL_DAYS,
  paymentGraceDays: env.PAYMENT_GRACE_DAYS,
  analyticsTimezone: env.ANALYTICS_TIMEZONE,
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    planIds: {
      starter: env.RAZORPAY_PLAN_STARTER,
      pro: env.RAZORPAY_PLAN_PRO,
    },
    totalCount: env.RAZORPAY_TOTAL_COUNT,
    apiBase: env.RAZORPAY_API_BASE.replace(/\/+$/, ''),
  },
  rateLimit: {
    enabled: env.RATE_LIMIT_ENABLED,
    apiMax: env.API_RATE_LIMIT_MAX,
    authMax: env.AUTH_RATE_LIMIT_MAX,
    publicMax: env.PUBLIC_RATE_LIMIT_MAX,
  },
}

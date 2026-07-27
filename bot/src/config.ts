import 'dotenv/config';
import { z } from 'zod';

/** Parse env boolean correctly: "false" → false, "true" → true */
const boolFlag = (defaultVal: 'true' | 'false') =>
  z.enum(['true', 'false', '1', '0', '']).default(defaultVal).transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  BOT_USERNAME: z.string().default(''),
  ADMIN_IDS: z.string().default(''),
  DOMAIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().default('postgresql://sanaei:sanaei_secret@localhost:5432/sanaei_bot'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  BOT_PORT: z.coerce.number().default(3000),
  WEBHOOK_PATH: z.string().default('/webhook'),

  PANEL_URL: z.string().default(''),
  PANEL_API_KEY: z.string().default(''),
  PANEL_USERNAME: z.string().default('admin'),
  PANEL_PASSWORD: z.string().default('admin'),
  PANEL_SUB_PATH: z.string().default('/sub'),

  ZARINPAL_MERCHANT_ID: z.string().default(''),
  AQAYEPARDAKHT_PIN: z.string().default(''),
  IRANPAY_API_KEY: z.string().default(''),
  NOWPAYMENTS_API_KEY: z.string().default(''),
  PLISIO_API_KEY: z.string().default(''),
  TRONADO_API_KEY: z.string().default(''),
  TRONADO_WALLET: z.string().default(''),
  CARD_NUMBER: z.string().default(''),
  CARD_HOLDER: z.string().default(''),

  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  MINIAPP_URL: z.string().default(''),

  CHANNEL_ID: z.string().default(''),
  CHANNEL_ENABLED: boolFlag('false'),

  TRIAL_ENABLED: boolFlag('true'),
  TRIAL_DAYS: z.coerce.number().default(1),
  TRIAL_VOLUME_GB: z.coerce.number().default(1),
  REFERRAL_ENABLED: boolFlag('true'),
  REFERRAL_REWARD: z.coerce.number().default(10000),
  LOTTERY_ENABLED: boolFlag('true'),
  PHONE_VERIFY_ENABLED: boolFlag('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const adminIds = config.ADMIN_IDS.split(',')
  .map((id) => parseInt(id.trim(), 10))
  .filter((id) => !isNaN(id));

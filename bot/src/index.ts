import express from 'express';
import cors from 'cors';
import { config, getCorsOrigins } from './config.js';
import { createBot } from './bot/index.js';
import { webhookCallback } from 'grammy';
import { createApiRouter } from './api/index.js';
import { createAdminRouter } from './api/admin.js';
import { startCronJobs } from './cron/index.js';
import { runMigrations } from './db/index.js';
import { getRedis } from './db/redis.js';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('🚀 Starting Sanaei VPN Bot...');

  await runMigrations();
  console.log('🗄️ Database ready');

  // Warm Redis (sessions)
  try {
    await getRedis();
  } catch (err) {
    console.warn('⚠️ Redis unavailable — sessions will fail writes until Redis is up:', err);
  }

  const app = express();
  const corsOrigins = getCorsOrigins();
  app.use(
    cors({
      origin: corsOrigins === true ? true : corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  const bot = createBot();

  const isProduction = process.env.NODE_ENV === 'production';
  const usePolling = config.USE_POLLING || !isProduction;
  let pollingStarted = false;

  if (!usePolling) {
    // Optional secret token header check
    if (config.WEBHOOK_SECRET) {
      app.use(config.WEBHOOK_PATH, (req, res, next) => {
        const secret = req.get('X-Telegram-Bot-Api-Secret-Token');
        if (secret !== config.WEBHOOK_SECRET) {
          return res.sendStatus(401);
        }
        next();
      });
    }
    app.use(config.WEBHOOK_PATH, webhookCallback(bot, 'express'));
    console.log(`📡 Webhook mode: ${config.DOMAIN}${config.WEBHOOK_PATH}`);
  } else {
    bot.start({
      onStart: (botInfo) => {
        pollingStarted = true;
        console.log(`✅ Bot @${botInfo.username} started in polling mode`);
      },
    });
  }

  app.use('/api', createApiRouter());
  app.use('/api/admin', createAdminRouter());

  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[API Error]', err.message || err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  app.get('/health', async (_req, res) => {
    const health: Record<string, unknown> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    try {
      await db.execute(sql`SELECT 1`);
      health.db = 'ok';
    } catch {
      health.db = 'error';
      health.status = 'degraded';
    }
    try {
      const redis = await getRedis();
      await redis.ping();
      health.redis = 'ok';
    } catch {
      health.redis = 'error';
      health.status = 'degraded';
    }
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });

  app.listen(config.BOT_PORT, async () => {
    console.log(`🌐 Server running on port ${config.BOT_PORT}`);

    if (!usePolling) {
      try {
        const webhookUrl = `${config.DOMAIN}${config.WEBHOOK_PATH}`;
        await bot.api.setWebhook(webhookUrl, {
          secret_token: config.WEBHOOK_SECRET || undefined,
          drop_pending_updates: false,
        });
        console.log(`📡 Webhook registered: ${webhookUrl}`);
      } catch (err) {
        console.error('FATAL: Failed to set webhook. Bot will NOT receive updates.', err);
        if (!pollingStarted) {
          console.log('⚠️ Falling back to polling mode...');
          try {
            await bot.api.deleteWebhook({ drop_pending_updates: false });
          } catch {
            /* */
          }
          bot.start({
            onStart: (botInfo) => {
              pollingStarted = true;
              console.log(`✅ Bot @${botInfo.username} started in polling fallback mode`);
            },
          });
        }
      }
    }
  });

  startCronJobs();
  console.log('⏰ Cron jobs started');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

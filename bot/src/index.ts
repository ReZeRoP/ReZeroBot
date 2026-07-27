import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { createBot } from './bot/index.js';
import { webhookCallback } from 'grammy';
import { createApiRouter } from './api/index.js';
import { createAdminRouter } from './api/admin.js';
import { startCronJobs } from './cron/index.js';
import { runMigrations } from './db/index.js';

async function main() {
  console.log('🚀 Starting Sanaei VPN Bot...');

  // Run database migrations
  await runMigrations();
  console.log('🗄️ Database ready');

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Create bot
  const bot = createBot();

  // Setup webhook or polling
  const isProduction = process.env.NODE_ENV === 'production';
  const usePolling = config.USE_POLLING || !isProduction;

  if (!usePolling) {
    // Webhook mode (requires HTTPS reverse proxy)
    app.use(config.WEBHOOK_PATH, webhookCallback(bot, 'express'));
    console.log(`📡 Webhook mode: ${config.DOMAIN}${config.WEBHOOK_PATH}`);
  } else {
    // Polling mode (no HTTPS needed)
    bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Bot @${botInfo.username} started in polling mode`);
      },
    });
  }

  // Mount API routes
  const apiRouter = createApiRouter();
  app.use('/api', apiRouter);

  // Mount Admin API routes
  const adminRouter = createAdminRouter();
  app.use('/api/admin', adminRouter);

  // Global error handler (must be after routes)
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[API Error]', err.message || err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Start server
  app.listen(config.BOT_PORT, async () => {
    console.log(`🌐 Server running on port ${config.BOT_PORT}`);
    // Register webhook AFTER server is listening (only in webhook mode)
    if (!usePolling) {
      try {
        await bot.api.setWebhook(`${config.DOMAIN}${config.WEBHOOK_PATH}`);
        console.log(`📡 Webhook registered: ${config.DOMAIN}${config.WEBHOOK_PATH}`);
      } catch (err) {
        console.error('FATAL: Failed to set webhook. Bot will NOT receive updates.', err);
        console.error('Fix: Set USE_POLLING=true in .env or ensure HTTPS is available.');
        // Fallback to polling so the bot still works
        console.log('⚠️ Falling back to polling mode...');
        bot.start({
          onStart: (botInfo) => {
            console.log(`✅ Bot @${botInfo.username} started in polling fallback mode`);
          },
        });
      }
    }
  });

  // Start cron jobs
  startCronJobs();
  console.log('⏰ Cron jobs started');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

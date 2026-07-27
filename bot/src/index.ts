import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { createBot } from './bot/index.js';
import { webhookCallback } from 'grammy';
import { createApiRouter } from './api/index.js';
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

  if (isProduction) {
    // Webhook mode
    app.use(config.WEBHOOK_PATH, webhookCallback(bot, 'express'));
    console.log(`📡 Webhook mode: ${config.DOMAIN}${config.WEBHOOK_PATH}`);

    await bot.api.setWebhook(`${config.DOMAIN}${config.WEBHOOK_PATH}`);
  } else {
    // Polling mode for development
    bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Bot @${botInfo.username} started in polling mode`);
      },
    });
  }

  // Mount API routes
  const apiRouter = createApiRouter();
  app.use('/api', apiRouter);

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
  app.listen(config.BOT_PORT, () => {
    console.log(`🌐 Server running on port ${config.BOT_PORT}`);
  });

  // Start cron jobs
  startCronJobs();
  console.log('⏰ Cron jobs started');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

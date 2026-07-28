import cron from 'node-cron';
import { eq, and, lt, isNull, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, payments, trials, users } from '../db/schema.js';
import { sanaeiClient } from '../panels/sanaei/client.js';
import { config, adminIds } from '../config.js';
import { Api } from 'grammy';
import { t, type Language } from '../i18n/index.js';
import { disableOrderOnPanel } from '../services/order.service.js';

const tgApi = new Api(config.BOT_TOKEN);

export function startCronJobs() {
  // Expiry reminder: once per order when within 3 days (and not yet reminded)
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const expiringSoon = await db.query.orders.findMany({
        where: and(
          eq(orders.status, 'active'),
          lt(orders.expireAt, threeDays),
          gte(orders.expireAt, now),
          isNull(orders.reminderSentAt),
        ),
      });

      for (const order of expiringSoon) {
        const user = await db.query.users.findFirst({ where: eq(users.id, order.userId) });
        if (!user) continue;

        const lang = (user.language || 'fa') as Language;
        const daysLeft = Math.max(
          0,
          Math.ceil((order.expireAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        );

        try {
          await tgApi.sendMessage(
            user.telegramId,
            t(lang, 'expiry_reminder', {
              days: daysLeft,
              service: order.usernameOnPanel || `#${order.id}`,
            }),
          );
          await db.update(orders).set({ reminderSentAt: new Date() }).where(eq(orders.id, order.id));
        } catch {
          /* */
        }
      }
    } catch (err) {
      console.error('[CRON] Expiry reminder error:', err);
    }
  });

  // Mark expired + disable on panel
  cron.schedule('*/30 * * * *', async () => {
    try {
      const now = new Date();
      const expiredOrders = await db.query.orders.findMany({
        where: and(eq(orders.status, 'active'), lt(orders.expireAt, now)),
      });

      for (const order of expiredOrders) {
        await db.update(orders).set({ status: 'expired' }).where(eq(orders.id, order.id));
        await disableOrderOnPanel(order);

        const user = await db.query.users.findFirst({ where: eq(users.id, order.userId) });
        if (user) {
          const lang = (user.language || 'fa') as Language;
          try {
            await tgApi.sendMessage(
              user.telegramId,
              t(lang, 'service_expired', {
                service: order.usernameOnPanel || `#${order.id}`,
              }),
            );
          } catch {
            /* */
          }
        }
      }
    } catch (err) {
      console.error('[CRON] Expire check error:', err);
    }
  });

  // Expire old pending online payments
  cron.schedule('*/5 * * * *', async () => {
    try {
      const pendingPayments = await db.query.payments.findMany({
        where: eq(payments.status, 'pending'),
      });

      for (const payment of pendingPayments) {
        if (payment.gateway === 'card') continue;
        const age = Date.now() - payment.createdAt.getTime();
        if (age > 2 * 60 * 60 * 1000) {
          await db
            .update(payments)
            .set({ status: 'expired' })
            .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')));
        }
      }
    } catch (err) {
      console.error('[CRON] Payment check error:', err);
    }
  });

  // Panel health
  cron.schedule('*/10 * * * *', async () => {
    try {
      if (!config.PANEL_URL && !config.PANEL_API_KEY) return;
      const result = await sanaeiClient.testConnection();
      if (!result.success) {
        console.error(`[CRON] Panel health check failed: ${result.message}`);
        for (const adminId of adminIds) {
          try {
            await tgApi.sendMessage(adminId, `⚠️ Panel health check failed:\n${result.message}`);
          } catch {
            /* */
          }
        }
      }
    } catch (err) {
      console.error('[CRON] Panel health check error:', err);
    }
  });

  // Trial cleanup
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const expiredTrials = await db.query.trials.findMany({
        where: lt(trials.expireAt, now),
      });

      for (const trial of expiredTrials) {
        if (trial.orderId) {
          const order = await db.query.orders.findFirst({ where: eq(orders.id, trial.orderId) });
          if (order && order.status === 'active') {
            await db.update(orders).set({ status: 'expired' }).where(eq(orders.id, trial.orderId));
            await disableOrderOnPanel(order);
          }
        }
      }
    } catch (err) {
      console.error('[CRON] Trial cleanup error:', err);
    }
  });

  // Auto-expire old card receipts
  cron.schedule('0 2 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oldPending = await db.query.payments.findMany({
        where: and(
          eq(payments.status, 'pending'),
          eq(payments.gateway, 'card'),
          lt(payments.createdAt, cutoff),
        ),
      });

      for (const payment of oldPending) {
        await db
          .update(payments)
          .set({ status: 'expired' })
          .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')));

        if (payment.userId) {
          const user = await db.query.users.findFirst({ where: eq(users.id, payment.userId) });
          if (user) {
            try {
              await tgApi.sendMessage(
                user.telegramId,
                t((user.language || 'fa') as Language, 'payment_rejected'),
              );
            } catch {
              /* */
            }
          }
        }
      }
    } catch (err) {
      console.error('[CRON] Receipt expiry error:', err);
    }
  });

  console.log('[CRON] All scheduled jobs registered');
}

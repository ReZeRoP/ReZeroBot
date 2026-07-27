import cron from 'node-cron';
import { eq, and, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, payments, trials } from '../db/schema.js';
import { sanaeiClient } from '../panels/sanaei/client.js';
import { config } from '../config.js';

export function startCronJobs() {
  // Expiry reminder: check every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find orders expiring within 3 days
      const expiringSoon = await db.query.orders.findMany({
        where: and(
          eq(orders.status, 'active'),
          lt(orders.expireAt, threeDays),
        ),
      });

      for (const order of expiringSoon) {
        // TODO: Send notification to user via bot
        console.log(`[CRON] Order #${order.id} expiring soon`);
      }
    } catch (err) {
      console.error('[CRON] Expiry reminder error:', err);
    }
  });

  // Mark expired orders: check every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const now = new Date();
      const expiredOrders = await db.query.orders.findMany({
        where: and(
          eq(orders.status, 'active'),
          lt(orders.expireAt, now),
        ),
      });

      for (const order of expiredOrders) {
        await db.update(orders).set({ status: 'expired' }).where(eq(orders.id, order.id));
        console.log(`[CRON] Order #${order.id} marked as expired`);
      }
    } catch (err) {
      console.error('[CRON] Expire check error:', err);
    }
  });

  // Payment check: poll pending payments every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const pendingPayments = await db.query.payments.findMany({
        where: eq(payments.status, 'pending'),
      });

      for (const payment of pendingPayments) {
        // Check with gateway if payment is confirmed
        // TODO: Implement per-gateway check
        console.log(`[CRON] Checking payment #${payment.id}`);
      }
    } catch (err) {
      console.error('[CRON] Payment check error:', err);
    }
  });

  // Panel health check: every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const result = await sanaeiClient.testConnection();
      if (!result.success) {
        console.error(`[CRON] Panel health check failed: ${result.message}`);
        // TODO: Notify admin
      }
    } catch (err) {
      console.error('[CRON] Panel health check error:', err);
    }
  });

  // Trial cleanup: disable expired trials daily
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const expiredTrials = await db.query.trials.findMany({
        where: lt(trials.expireAt, now),
      });

      for (const trial of expiredTrials) {
        if (trial.orderId) {
          await db.update(orders).set({ status: 'expired' }).where(eq(orders.id, trial.orderId));
        }
        console.log(`[CRON] Trial #${trial.id} expired and cleaned up`);
      }
    } catch (err) {
      console.error('[CRON] Trial cleanup error:', err);
    }
  });

  // Auto-reject old receipts: daily
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
        await db.update(payments).set({ status: 'expired' }).where(eq(payments.id, payment.id));
        console.log(`[CRON] Payment #${payment.id} auto-expired`);
      }
    } catch (err) {
      console.error('[CRON] Receipt expiry error:', err);
    }
  });

  console.log('[CRON] All scheduled jobs registered');
}

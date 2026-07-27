import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';
import { getUserByTelegramId } from '../services/user.service.js';
import { getActiveCategories, getProductsByCategory, getProductById } from '../services/product.service.js';
import { getUserOrders, getOrderById, createOrder, renewOrder, addVolumeToOrder } from '../services/order.service.js';
import { db } from '../db/index.js';
import { walletTransactions, users, discountCodes, trials, payments, orders } from '../db/schema.js';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

/** Async handler wrapper for Express 4 — catches rejections and forwards to error middleware */
const ah = (fn: (req: any, res: any, next: any) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function createApiRouter(): Router {
  const router = Router();

  // === Auth Middleware ===
  function authMiddleware(req: any, res: any, next: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as { telegramId: number };
      req.telegramId = decoded.telegramId;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // === Telegram WebApp Auth ===
  router.post('/v1/auth/telegram', ah(async (req: any, res: any) => {
    const { initData } = req.body;
    if (!initData) return res.status(400).json({ error: 'initData required' });

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return res.status(400).json({ error: 'Invalid initData' });

    // Check auth_date freshness (reject older than 5 minutes)
    const authDate = params.get('auth_date');
    if (authDate) {
      const age = Math.abs(Date.now() / 1000 - parseInt(authDate));
      if (age > 300) return res.status(401).json({ error: 'initData expired' });
    }

    params.delete('hash');
    // Sort by byte order (not locale)
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.BOT_TOKEN).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // Timing-safe comparison
    const computedBuf = Buffer.from(computedHash, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (computedBuf.length !== hashBuf.length || !crypto.timingSafeEqual(computedBuf, hashBuf)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const userStr = params.get('user');
    if (!userStr) return res.status(400).json({ error: 'No user data' });

    const tgUser = JSON.parse(userStr);
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return res.status(404).json({ error: 'User not found. Use /start first.' });

    const token = jwt.sign({ telegramId: tgUser.id, userId: user.id }, config.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user.id, balance: user.balance, language: user.language } });
  }));

  // === User Routes ===
  router.get('/v1/user/profile', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      balance: user.balance,
      language: user.language,
      refCode: user.refCode,
      createdAt: user.createdAt,
    });
  }));

  // === Products ===
  router.get('/v1/products', authMiddleware, ah(async (_req: any, res: any) => {
    const cats = await getActiveCategories();
    const result = await Promise.all(
      cats.map(async (cat) => ({
        ...cat,
        products: await getProductsByCategory(cat.id),
      })),
    );
    res.json(result);
  }));

  // === Orders ===
  router.get('/v1/orders', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const userOrders = await getUserOrders(user.id);
    res.json(userOrders);
  }));

  router.get('/v1/orders/:id', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const order = await getOrderById(parseInt(req.params.id));
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  }));

  router.post('/v1/orders', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { productId, discountCode } = req.body;
    const product = await getProductById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let finalPrice = product.price;
    if (discountCode) {
      const code = await db.query.discountCodes.findFirst({
        where: eq(discountCodes.code, discountCode),
      });
      if (code && code.isActive) {
        // Validate expiry and usage
        if (code.expireAt && code.expireAt < new Date()) {
          return res.status(400).json({ error: 'Discount code expired' });
        }
        if (code.maxUses && code.usedCount >= code.maxUses) {
          return res.status(400).json({ error: 'Discount code used up' });
        }
        const percent = Math.min(code.percent, 100);
        finalPrice = Math.round(finalPrice * (1 - percent / 100));
        // Increment usage atomically
        await db.update(discountCodes).set({ usedCount: sql`${discountCodes.usedCount} + 1` }).where(eq(discountCodes.id, code.id));
      }
    }

    if (user.balance < finalPrice) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Atomic: deduct + create order
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(users)
        .set({ balance: sql`${users.balance} - ${finalPrice}`, updatedAt: new Date() })
        .where(and(eq(users.id, user.id), gte(users.balance, finalPrice)))
        .returning();

      if (!updated) throw new Error('Insufficient balance');

      await tx.insert(walletTransactions).values({
        userId: user.id,
        amount: -finalPrice,
        type: 'purchase',
        description: `Purchase product #${productId}`,
      });

      return createOrder({ userId: user.id, productId, finalPrice, discountCode });
    });

    res.json(result);
  }));

  router.post('/v1/orders/:id/renew', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const order = await getOrderById(parseInt(req.params.id));
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'Not found' });

    const { days } = req.body;
    const updated = await renewOrder(order.id, days || order.durationDays);
    res.json(updated);
  }));

  router.post('/v1/orders/:id/volume', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const order = await getOrderById(parseInt(req.params.id));
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'Not found' });

    const { gb } = req.body;
    const updated = await addVolumeToOrder(order.id, gb || 1);
    res.json(updated);
  }));

  // === Wallet ===
  router.get('/v1/wallet', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const txs = await db.query.walletTransactions.findMany({
      where: eq(walletTransactions.userId, user.id),
      orderBy: [desc(walletTransactions.createdAt)],
      limit: 50,
    });

    res.json({ balance: user.balance, transactions: txs });
  }));

  // === Referral ===
  router.get('/v1/referral', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { getReferralStats } = await import('../services/user.service.js');
    const stats = await getReferralStats(user.id);
    res.json({
      link: `https://t.me/${config.BOT_USERNAME}?start=${user.refCode}`,
      code: user.refCode,
      ...stats,
    });
  }));

  // === Discount ===
  router.post('/v1/discount/apply', authMiddleware, ah(async (req: any, res: any) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });

    const discount = await db.query.discountCodes.findFirst({
      where: eq(discountCodes.code, code),
    });

    if (!discount || !discount.isActive) {
      return res.status(404).json({ error: 'Invalid code' });
    }
    if (discount.expireAt && discount.expireAt < new Date()) {
      return res.status(400).json({ error: 'Code expired' });
    }
    if (discount.maxUses && discount.usedCount >= discount.maxUses) {
      return res.status(400).json({ error: 'Code used up' });
    }

    res.json({ percent: discount.percent, valid: true });
  }));

  // === Trial ===
  router.post('/v1/trial', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!config.TRIAL_ENABLED) return res.status(400).json({ error: 'Trial disabled' });

    const existingTrial = await db.query.trials.findFirst({
      where: eq(trials.userId, user.id),
    });
    if (existingTrial) return res.status(400).json({ error: 'Trial already used' });

    const result = await createOrder({
      userId: user.id,
      productId: 1,
      isTrial: true,
      finalPrice: 0,
    });

    await db.insert(trials).values({
      userId: user.id,
      orderId: result.order.id,
      expireAt: new Date(Date.now() + config.TRIAL_DAYS * 24 * 60 * 60 * 1000),
    });

    res.json(result);
  }));

  // === Payment Callbacks ===
  router.get('/v1/payment/zarinpal/callback', ah(async (req: any, res: any) => {
    const { Authority, Status } = req.query;
    if (Status !== 'OK' || !Authority) {
      return res.redirect(`${config.MINIAPP_URL || '/'}?payment=failed`);
    }

    // Find pending payment with this authority
    const payment = await db.query.payments.findFirst({
      where: and(eq(payments.refId, Authority as string), eq(payments.status, 'pending')),
    });
    if (!payment) return res.redirect(`${config.MINIAPP_URL || '/'}?payment=notfound`);

    // Verify with Zarinpal
    const { zarinpalVerify } = await import('../payments/index.js');
    const verified = await zarinpalVerify(Authority as string, payment.amount);

    if (verified.success) {
      await db.update(payments).set({ status: 'confirmed' }).where(eq(payments.id, payment.id));
      // Credit wallet
      await db.update(users).set({ balance: sql`${users.balance} + ${payment.amount}`, updatedAt: new Date() }).where(eq(users.id, payment.userId));
      await db.insert(walletTransactions).values({
        userId: payment.userId,
        amount: payment.amount,
        type: 'charge',
        description: `Zarinpal payment #${payment.id}`,
      });
      return res.redirect(`${config.MINIAPP_URL || '/'}?payment=success`);
    }

    await db.update(payments).set({ status: 'rejected' }).where(eq(payments.id, payment.id));
    return res.redirect(`${config.MINIAPP_URL || '/'}?payment=failed`);
  }));

  // === Support ===
  router.get('/v1/support/faq', authMiddleware, ah(async (_req: any, res: any) => {
    res.json([
      { q: 'How to connect?', a: 'Import the config link in your VPN client app.' },
      { q: 'How to renew?', a: 'Go to My Services, select the service, and click Renew.' },
      { q: 'Payment issues?', a: 'Contact support with your receipt.' },
    ]);
  }));

  return router;
}

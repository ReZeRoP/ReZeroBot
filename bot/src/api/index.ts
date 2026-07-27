import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';
import { getUserByTelegramId } from '../services/user.service.js';
import { getActiveCategories, getProductsByCategory, getProductById } from '../services/product.service.js';
import { getActiveOrders, getUserOrders, getOrderById, createOrder, renewOrder, addVolumeToOrder } from '../services/order.service.js';
import { db } from '../db/index.js';
import { walletTransactions, users, discountCodes, trials } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

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
  router.post('/v1/auth/telegram', async (req, res) => {
    const { initData } = req.body;
    if (!initData) return res.status(400).json({ error: 'initData required' });

    // Validate Telegram WebApp initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return res.status(400).json({ error: 'Invalid initData' });

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.BOT_TOKEN).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash !== hash) {
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
  });

  // === User Routes ===
  router.get('/v1/user/profile', authMiddleware, async (req: any, res) => {
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
  });

  // === Products ===
  router.get('/v1/products', authMiddleware, async (_req, res) => {
    const cats = await getActiveCategories();
    const result = await Promise.all(
      cats.map(async (cat) => ({
        ...cat,
        products: await getProductsByCategory(cat.id),
      })),
    );
    res.json(result);
  });

  // === Orders ===
  router.get('/v1/orders', authMiddleware, async (req: any, res) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const orders = await getUserOrders(user.id);
    res.json(orders);
  });

  router.get('/v1/orders/:id', authMiddleware, async (req: any, res) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const order = await getOrderById(parseInt(req.params.id));
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  });

  router.post('/v1/orders', authMiddleware, async (req: any, res) => {
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
        finalPrice = Math.round(finalPrice * (1 - code.percent / 100));
      }
    }

    if (user.balance < finalPrice) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    try {
      const result = await createOrder({ userId: user.id, productId, finalPrice, discountCode });
      // Deduct balance
      await db.update(users).set({ balance: user.balance - finalPrice }).where(eq(users.id, user.id));
      await db.insert(walletTransactions).values({
        userId: user.id,
        amount: -finalPrice,
        type: 'purchase',
        description: `Purchase product #${productId}`,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  router.post('/v1/orders/:id/renew', authMiddleware, async (req: any, res) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const order = await getOrderById(parseInt(req.params.id));
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'Not found' });

    const { days } = req.body;
    try {
      const updated = await renewOrder(order.id, days || order.durationDays);
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Renew failed' });
    }
  });

  router.post('/v1/orders/:id/volume', authMiddleware, async (req: any, res) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const order = await getOrderById(parseInt(req.params.id));
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'Not found' });

    const { gb } = req.body;
    try {
      const updated = await addVolumeToOrder(order.id, gb || 1);
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Volume add failed' });
    }
  });

  // === Wallet ===
  router.get('/v1/wallet', authMiddleware, async (req: any, res) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const txs = await db.query.walletTransactions.findMany({
      where: eq(walletTransactions.userId, user.id),
      orderBy: [desc(walletTransactions.createdAt)],
      limit: 50,
    });

    res.json({ balance: user.balance, transactions: txs });
  });

  // === Referral ===
  router.get('/v1/referral', authMiddleware, async (req: any, res) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { getReferralStats } = await import('../services/user.service.js');
    const stats = await getReferralStats(user.id);
    res.json({
      link: `https://t.me/${config.BOT_USERNAME}?start=${user.refCode}`,
      code: user.refCode,
      ...stats,
    });
  });

  // === Discount ===
  router.post('/v1/discount/apply', authMiddleware, async (req, res) => {
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
  });

  // === Trial ===
  router.post('/v1/trial', authMiddleware, async (req: any, res) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!config.TRIAL_ENABLED) return res.status(400).json({ error: 'Trial disabled' });

    const existingTrial = await db.query.trials.findFirst({
      where: eq(trials.userId, user.id),
    });
    if (existingTrial) return res.status(400).json({ error: 'Trial already used' });

    try {
      const result = await createOrder({
        userId: user.id,
        productId: 1, // Default trial product
        isTrial: true,
        finalPrice: 0,
      });

      await db.insert(trials).values({
        userId: user.id,
        orderId: result.order.id,
        expireAt: new Date(Date.now() + config.TRIAL_DAYS * 24 * 60 * 60 * 1000),
      });

      res.json(result);
    } catch {
      res.status(500).json({ error: 'Trial creation failed' });
    }
  });

  // === Support ===
  router.get('/v1/support/faq', authMiddleware, async (_req, res) => {
    res.json([
      { q: 'How to connect?', a: 'Import the config link in your VPN client app.' },
      { q: 'How to renew?', a: 'Go to My Services, select the service, and click Renew.' },
      { q: 'Payment issues?', a: 'Contact support with your receipt.' },
    ]);
  });

  return router;
}

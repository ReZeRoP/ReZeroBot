import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';
import { getUserByTelegramId } from '../services/user.service.js';
import { getActiveCategories, getProductsByCategory, getProductById } from '../services/product.service.js';
import {
  getUserOrders,
  getOrderById,
  purchaseWithWallet,
  renewOrderWithWallet,
  addVolumeWithWallet,
  createOrder,
} from '../services/order.service.js';
import { db } from '../db/index.js';
import { walletTransactions, discountCodes, trials, payments, products } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { validateDiscountCode, priceAfterDiscount, redeemGiftCode } from '../services/discount.service.js';
import {
  createPendingPayment,
  confirmAndFulfillPayment,
} from '../services/payment.service.js';
import { zarinpalRequest, zarinpalVerify } from '../payments/index.js';

const ah = (fn: (req: any, res: any, next: any) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function createApiRouter(): Router {
  const router = Router();

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

    const authDate = params.get('auth_date');
    if (authDate) {
      const age = Math.abs(Date.now() / 1000 - parseInt(authDate, 10));
      if (age > 86400) return res.status(401).json({ error: 'initData expired' });
    }

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.BOT_TOKEN).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

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
    if (user.isBlocked) return res.status(403).json({ error: 'Account blocked' });

    const token = jwt.sign({ telegramId: tgUser.id, userId: user.id }, config.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: {
        id: user.id,
        balance: user.balance,
        language: user.language,
        firstName: user.firstName,
        username: user.username,
      },
    });
  }));

  // === Profile ===
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
    res.json(await getUserOrders(user.id));
  }));

  router.get('/v1/orders/:id', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const order = await getOrderById(parseInt(req.params.id, 10));
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  }));

  router.post('/v1/orders', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { productId, discountCode } = req.body;
    const product = await getProductById(productId);
    if (!product || !product.isActive) return res.status(404).json({ error: 'Product not found' });

    let finalPrice = product.price;
    let validCode: string | undefined;
    if (discountCode) {
      const code = await validateDiscountCode(discountCode);
      if (!code) return res.status(400).json({ error: 'Invalid discount code' });
      finalPrice = priceAfterDiscount(product.price, code.percent);
      validCode = code.code;
    }

    if (user.balance < finalPrice) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    try {
      const result = await purchaseWithWallet(user.id, productId, finalPrice, validCode);
      if (validCode) {
        const { sql } = await import('drizzle-orm');
        await db
          .update(discountCodes)
          .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
          .where(eq(discountCodes.code, validCode));
      }
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Purchase failed' });
    }
  }));

  router.post('/v1/orders/:id/renew', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const order = await getOrderById(parseInt(req.params.id, 10));
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'Not found' });

    const product = await getProductById(order.productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const days = Number(req.body.days) || product.durationDays || order.durationDays;
    const amount = product.price;

    try {
      const updated = await renewOrderWithWallet(user.id, order.id, amount, days);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Renew failed' });
    }
  }));

  router.post('/v1/orders/:id/volume', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const order = await getOrderById(parseInt(req.params.id, 10));
    if (!order || order.userId !== user.id) return res.status(404).json({ error: 'Not found' });

    const gb = Math.max(1, Math.min(1000, Number(req.body.gb) || 10));
    const amount = config.VOLUME_GB_PRICE * gb;
    if (amount <= 0) return res.status(400).json({ error: 'Volume top-up not configured' });

    try {
      const updated = await addVolumeWithWallet(user.id, order.id, gb, amount);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Volume add failed' });
    }
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

  router.post('/v1/wallet/charge', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const amount = parseInt(req.body.amount, 10);
    const gateway = (req.body.gateway || 'zarinpal') as string;
    if (!amount || amount < 1000) return res.status(400).json({ error: 'Invalid amount' });

    if (gateway === 'zarinpal') {
      if (!config.ZARINPAL_MERCHANT_ID) return res.status(400).json({ error: 'Zarinpal not configured' });
      const result = await zarinpalRequest({
        amount,
        userId: user.id,
        description: `Wallet charge ${amount}`,
      });
      if (!result.success || !result.paymentUrl) {
        return res.status(400).json({ error: result.error || 'Payment request failed' });
      }
      const payment = await createPendingPayment({
        userId: user.id,
        amount,
        gateway: 'zarinpal',
        purpose: 'wallet_charge',
        description: `Wallet charge: ${amount}`,
        authority: result.authority,
        refId: result.authority,
      });
      return res.json({ paymentId: payment.id, paymentUrl: result.paymentUrl });
    }

    if (gateway === 'card') {
      const payment = await createPendingPayment({
        userId: user.id,
        amount,
        gateway: 'card',
        purpose: 'wallet_charge',
        description: `Wallet charge: ${amount}`,
      });
      return res.json({
        paymentId: payment.id,
        card: config.CARD_NUMBER,
        holder: config.CARD_HOLDER,
        amount,
      });
    }

    return res.status(400).json({ error: 'Unsupported gateway' });
  }));

  router.post('/v1/gift/redeem', authMiddleware, ah(async (req: any, res: any) => {
    const user = await getUserByTelegramId(req.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    try {
      const gift = await redeemGiftCode(user.id, code);
      res.json({ success: true, amount: gift.amount });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid gift code' });
    }
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

  // === Discount preview (no consume) ===
  router.post('/v1/discount/apply', authMiddleware, ah(async (req: any, res: any) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const discount = await validateDiscountCode(code);
    if (!discount) return res.status(404).json({ error: 'Invalid code' });
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

    const trialProduct = await db.query.products.findFirst({
      where: eq(products.isActive, true),
    });
    if (!trialProduct) return res.status(400).json({ error: 'No products available for trial' });

    try {
      const result = await createOrder({
        userId: user.id,
        productId: trialProduct.id,
        isTrial: true,
        finalPrice: 0,
      });

      try {
        await db.insert(trials).values({
          userId: user.id,
          orderId: result.order.id,
          productId: trialProduct.id,
          expireAt: new Date(Date.now() + config.TRIAL_DAYS * 24 * 60 * 60 * 1000),
        });
      } catch {
        return res.status(400).json({ error: 'Trial already used' });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Trial failed' });
    }
  }));

  // === Zarinpal callback ===
  router.get('/v1/payment/zarinpal/callback', ah(async (req: any, res: any) => {
    const { Authority, Status } = req.query;
    const redirectBase = config.MINIAPP_URL || config.DOMAIN || '/';

    if (Status !== 'OK' || !Authority) {
      return res.redirect(`${redirectBase}?payment=failed`);
    }

    const payment = await db.query.payments.findFirst({
      where: and(eq(payments.refId, Authority as string), eq(payments.status, 'pending')),
    });

    // Also try authority column
    const payment2 =
      payment ||
      (await db.query.payments.findFirst({
        where: and(eq(payments.authority, Authority as string), eq(payments.status, 'pending')),
      }));

    if (!payment2) return res.redirect(`${redirectBase}?payment=notfound`);

    const verified = await zarinpalVerify(Authority as string, payment2.amount);
    if (!verified.success) {
      return res.redirect(`${redirectBase}?payment=failed`);
    }

    const result = await confirmAndFulfillPayment(payment2.id, true);
    if (!result.ok && result.reason === 'already_processed') {
      return res.redirect(`${redirectBase}?payment=success`);
    }
    if (!result.ok) return res.redirect(`${redirectBase}?payment=failed`);

    return res.redirect(`${redirectBase}?payment=success`);
  }));

  // NowPayments IPN (best-effort)
  router.post('/v1/payment/nowpayments/ipn', ah(async (req: any, res: any) => {
    const body = req.body || {};
    const paymentStatus = body.payment_status || body.status;
    const invoiceId = String(body.invoice_id || body.id || body.order_id || '');
    if (!invoiceId) return res.status(400).json({ error: 'missing id' });

    if (!['finished', 'confirmed', 'paid', 'complete'].includes(String(paymentStatus).toLowerCase())) {
      return res.json({ ok: true, ignored: true });
    }

    const payment = await db.query.payments.findFirst({
      where: and(eq(payments.refId, invoiceId), eq(payments.status, 'pending')),
    });
    if (!payment) return res.json({ ok: true, notFound: true });

    await confirmAndFulfillPayment(payment.id, true);
    res.json({ ok: true });
  }));

  router.get('/v1/support/faq', authMiddleware, ah(async (_req: any, res: any) => {
    res.json([
      { q: 'How to connect?', a: 'Import the config link in your VPN client app.' },
      { q: 'How to renew?', a: 'Go to My Services, select the service, and click Renew (wallet balance required).' },
      { q: 'Payment issues?', a: 'Contact support with your receipt.' },
    ]);
  }));

  return router;
}

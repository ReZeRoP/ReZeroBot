import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, adminIds } from '../config.js';
import { db } from '../db/index.js';
import {
  users, products, categories, orders, payments, panels,
  discountCodes, giftCodes, settings, messages, walletTransactions,
} from '../db/schema.js';
import { eq, desc, sql, count } from 'drizzle-orm';

const ah = (fn: (req: any, res: any, next: any) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function createAdminRouter(): Router {
  const router = Router();

  // === Admin Auth Middleware ===
  function adminAuth(req: any, res: any, next: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as { adminId: number; role: string };
      req.adminId = decoded.adminId;
      req.adminRole = decoded.role;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
  }

  // === Admin Login ===
  router.post('/login', ah(async (req: any, res: any) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    // Simple auth: check against a shared secret (settings table)
    const adminSetting = await db.query.settings.findFirst({ where: eq(settings.key, 'admin_password') });
    const storedPass = adminSetting?.value || 'admin';

    if (username === 'admin' && password === storedPass) {
      const token = jwt.sign({ adminId: adminIds[0] || 0, role: 'owner' }, config.JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  }));

  // All routes below require admin auth
  router.use(adminAuth);

  // === Dashboard Stats ===
  router.get('/stats', ah(async (_req: any, res: any) => {
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalOrders] = await db.select({ count: count() }).from(orders);
    const [activeOrders] = await db.select({ count: count() }).from(orders).where(eq(orders.status, 'active'));
    const [totalRevenue] = await db.select({ total: sql`COALESCE(SUM(${orders.finalPrice}), 0)` }).from(orders).where(eq(orders.status, 'active'));
    const [pendingPayments] = await db.select({ count: count() }).from(payments).where(eq(payments.status, 'pending'));

    res.json({
      totalUsers: totalUsers.count,
      totalOrders: totalOrders.count,
      activeOrders: activeOrders.count,
      totalRevenue: totalRevenue.total,
      pendingPayments: pendingPayments.count,
    });
  }));

  // === Users Management ===
  router.get('/users', ah(async (req: any, res: any) => {
    const page = parseInt(req.query.page || '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    const userList = await db.select().from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(userList);
  }));

  router.post('/users/:id/block', ah(async (req: any, res: any) => {
    const userId = parseInt(req.params.id);
    const { blocked } = req.body;
    await db.update(users).set({ isBlocked: blocked, updatedAt: new Date() }).where(eq(users.id, userId));
    res.json({ success: true });
  }));

  router.post('/users/:id/balance', ah(async (req: any, res: any) => {
    const userId = parseInt(req.params.id);
    const { amount, reason } = req.body;
    await db.update(users).set({ balance: sql`${users.balance} + ${amount}`, updatedAt: new Date() }).where(eq(users.id, userId));
    await db.insert(walletTransactions).values({
      userId,
      amount,
      type: 'admin_adjust',
      description: reason || 'Admin adjustment',
    });
    res.json({ success: true });
  }));

  // === Products CRUD ===
  router.get('/products', ah(async (_req: any, res: any) => {
    const productList = await db.select().from(products).orderBy(products.sortOrder);
    res.json(productList);
  }));

  router.post('/products', ah(async (req: any, res: any) => {
    const { categoryId, inboundId, name, nameEn, description, price, volumeGb, durationDays, protocol } = req.body;
    const [product] = await db.insert(products).values({
      categoryId, inboundId, name, nameEn, description, price, volumeGb, durationDays, protocol,
    }).returning();
    res.json(product);
  }));

  router.put('/products/:id', ah(async (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const { name, nameEn, description, price, volumeGb, durationDays, isActive, sortOrder, inboundId } = req.body;
    const [updated] = await db.update(products).set({
      name, nameEn, description, price, volumeGb, durationDays, isActive, sortOrder, inboundId,
    }).where(eq(products.id, id)).returning();
    res.json(updated);
  }));

  router.delete('/products/:id', ah(async (req: any, res: any) => {
    await db.delete(products).where(eq(products.id, parseInt(req.params.id)));
    res.json({ success: true });
  }));

  // === Categories CRUD ===
  router.get('/categories', ah(async (_req: any, res: any) => {
    const catList = await db.select().from(categories).orderBy(categories.sortOrder);
    res.json(catList);
  }));

  router.post('/categories', ah(async (req: any, res: any) => {
    const { name, nameEn, sortOrder } = req.body;
    const [cat] = await db.insert(categories).values({ name, nameEn, sortOrder: sortOrder || 0 }).returning();
    res.json(cat);
  }));

  router.delete('/categories/:id', ah(async (req: any, res: any) => {
    await db.delete(categories).where(eq(categories.id, parseInt(req.params.id)));
    res.json({ success: true });
  }));

  // === Orders ===
  router.get('/orders', ah(async (req: any, res: any) => {
    const page = parseInt(req.query.page || '1');
    const status = req.query.status as string;
    const limit = 20;
    const offset = (page - 1) * limit;

    let orderList;
    if (status) {
      orderList = await db.select().from(orders).where(eq(orders.status, status as any))
        .orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
    } else {
      orderList = await db.select().from(orders)
        .orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
    }
    res.json(orderList);
  }));

  // === Payments ===
  router.get('/payments', ah(async (req: any, res: any) => {
    const status = req.query.status as string;
    let paymentList;
    if (status) {
      paymentList = await db.select().from(payments).where(eq(payments.status, status as any))
        .orderBy(desc(payments.createdAt)).limit(50);
    } else {
      paymentList = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(50);
    }
    res.json(paymentList);
  }));

  router.post('/payments/:id/approve', ah(async (req: any, res: any) => {
    const paymentId = parseInt(req.params.id);
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!payment || payment.status !== 'pending') return res.status(400).json({ error: 'Invalid payment' });

    await db.update(payments).set({ status: 'confirmed', paidAt: new Date() }).where(eq(payments.id, paymentId));
    await db.update(users).set({ balance: sql`${users.balance} + ${payment.amount}`, updatedAt: new Date() }).where(eq(users.id, payment.userId));
    await db.insert(walletTransactions).values({
      userId: payment.userId,
      amount: payment.amount,
      type: 'charge',
      description: `Payment #${paymentId} approved by admin`,
    });
    res.json({ success: true });
  }));

  router.post('/payments/:id/reject', ah(async (req: any, res: any) => {
    const paymentId = parseInt(req.params.id);
    await db.update(payments).set({ status: 'rejected' }).where(eq(payments.id, paymentId));
    res.json({ success: true });
  }));

  // === Discount Codes ===
  router.get('/discounts', ah(async (_req: any, res: any) => {
    const codes = await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
    res.json(codes);
  }));

  router.post('/discounts', ah(async (req: any, res: any) => {
    const { code, percent, maxUses, expireAt } = req.body;
    const [discount] = await db.insert(discountCodes).values({
      code, percent, maxUses: maxUses || 0,
      expireAt: expireAt ? new Date(expireAt) : null,
    }).returning();
    res.json(discount);
  }));

  router.delete('/discounts/:id', ah(async (req: any, res: any) => {
    await db.delete(discountCodes).where(eq(discountCodes.id, parseInt(req.params.id)));
    res.json({ success: true });
  }));

  // === Gift Codes ===
  router.get('/gifts', ah(async (_req: any, res: any) => {
    const gifts = await db.select().from(giftCodes).orderBy(desc(giftCodes.createdAt));
    res.json(gifts);
  }));

  router.post('/gifts/generate', ah(async (req: any, res: any) => {
    const { count, amount } = req.body;
    const generated = [];
    for (let i = 0; i < (count || 1); i++) {
      const code = `GIFT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const [gift] = await db.insert(giftCodes).values({ code, amount }).returning();
      generated.push(gift);
    }
    res.json(generated);
  }));

  // === Settings ===
  router.get('/settings', ah(async (_req: any, res: any) => {
    const allSettings = await db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) settingsMap[s.key] = s.value || '';
    res.json(settingsMap);
  }));

  router.put('/settings', ah(async (req: any, res: any) => {
    const entries = Object.entries(req.body) as [string, string][];
    for (const [key, value] of entries) {
      const existing = await db.query.settings.findFirst({ where: eq(settings.key, key) });
      if (existing) {
        await db.update(settings).set({ value }).where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({ key, value });
      }
    }
    res.json({ success: true });
  }));

  // === Messages ===
  router.get('/messages', ah(async (_req: any, res: any) => {
    const msgs = await db.select().from(messages);
    res.json(msgs);
  }));

  router.put('/messages/:key', ah(async (req: any, res: any) => {
    const { faText, enText } = req.body;
    const existing = await db.query.messages.findFirst({ where: eq(messages.key, req.params.key) });
    if (existing) {
      await db.update(messages).set({ faText, enText }).where(eq(messages.key, req.params.key));
    } else {
      await db.insert(messages).values({ key: req.params.key, faText, enText });
    }
    res.json({ success: true });
  }));

  // === Panels ===
  router.get('/panels', ah(async (_req: any, res: any) => {
    const panelList = await db.select().from(panels);
    res.json(panelList);
  }));

  // === Backup ===
  router.post('/backup', ah(async (_req: any, res: any) => {
    // Trigger is handled by cron/shell — just acknowledge
    res.json({ success: true, message: 'Backup triggered' });
  }));

  return router;
}

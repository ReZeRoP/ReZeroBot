import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, adminIds } from '../config.js';
import { db } from '../db/index.js';
import {
  users,
  products,
  categories,
  orders,
  payments,
  panels,
  discountCodes,
  giftCodes,
  settings,
  messages,
  walletTransactions,
} from '../db/schema.js';
import { eq, desc, sql, count, ilike, or } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { confirmAndFulfillPayment, rejectPaymentAndNotify } from '../services/payment.service.js';
import { sanaeiClient } from '../panels/sanaei/client.js';

const ah = (fn: (req: any, res: any, next: any) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

async function getAdminPassword(): Promise<string> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, 'admin_password') });
  if (row?.value) return row.value;
  if (config.ADMIN_PASSWORD) return config.ADMIN_PASSWORD;
  // Insecure default only for first boot — force change via env in production
  return 'admin';
}

async function ensureAdminPasswordHashed() {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, 'admin_password') });
  const current = row?.value || config.ADMIN_PASSWORD;
  if (current && !current.startsWith('scrypt$') && current !== 'admin') {
    const hashed = hashPassword(current);
    if (row) {
      await db.update(settings).set({ value: hashed, updatedAt: new Date() }).where(eq(settings.key, 'admin_password'));
    } else {
      await db.insert(settings).values({ key: 'admin_password', value: hashed });
    }
  }
}

export function createAdminRouter(): Router {
  const router = Router();

  // Fire-and-forget bootstrap hash
  ensureAdminPasswordHashed().catch(() => {});

  function adminAuth(req: any, res: any, next: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as { adminId: number; role: string };
      if (decoded.role !== 'owner' && decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.adminId = decoded.adminId;
      req.adminRole = decoded.role;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
  }

  router.post('/login', ah(async (req: any, res: any) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const expectedUser = config.ADMIN_USERNAME || 'admin';
    if (username !== expectedUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const stored = await getAdminPassword();
    if (!verifyPassword(password, stored)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Upgrade plaintext to scrypt on successful login
    if (!stored.startsWith('scrypt$')) {
      const hashed = hashPassword(password);
      const existing = await db.query.settings.findFirst({ where: eq(settings.key, 'admin_password') });
      if (existing) {
        await db.update(settings).set({ value: hashed, updatedAt: new Date() }).where(eq(settings.key, 'admin_password'));
      } else {
        await db.insert(settings).values({ key: 'admin_password', value: hashed });
      }
    }

    const token = jwt.sign(
      { adminId: adminIds[0] || 1, role: 'owner' },
      config.JWT_SECRET,
      { expiresIn: '12h' },
    );
    return res.json({ token, username: expectedUser });
  }));

  router.use(adminAuth);

  router.get('/stats', ah(async (_req: any, res: any) => {
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalOrders] = await db.select({ count: count() }).from(orders);
    const [activeOrders] = await db.select({ count: count() }).from(orders).where(eq(orders.status, 'active'));
    const [totalRevenue] = await db
      .select({ total: sql<number>`COALESCE(SUM(${orders.finalPrice}), 0)` })
      .from(orders)
      .where(eq(orders.status, 'active'));
    const [pendingPayments] = await db
      .select({ count: count() })
      .from(payments)
      .where(eq(payments.status, 'pending'));

    res.json({
      totalUsers: totalUsers.count,
      totalOrders: totalOrders.count,
      activeOrders: activeOrders.count,
      totalRevenue: Number(totalRevenue.total) || 0,
      pendingPayments: pendingPayments.count,
    });
  }));

  // === Users ===
  router.get('/users', ah(async (req: any, res: any) => {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = 20;
    const offset = (page - 1) * limit;
    const q = (req.query.q as string) || '';

    let userList;
    if (q) {
      userList = await db
        .select()
        .from(users)
        .where(
          or(
            ilike(users.username, `%${q}%`),
            ilike(users.firstName, `%${q}%`),
            sql`CAST(${users.telegramId} AS TEXT) LIKE ${'%' + q + '%'}`,
          ),
        )
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      userList = await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    }
    res.json(userList);
  }));

  router.post('/users/:id/block', ah(async (req: any, res: any) => {
    const userId = parseInt(req.params.id, 10);
    const { blocked } = req.body;
    await db.update(users).set({ isBlocked: !!blocked, updatedAt: new Date() }).where(eq(users.id, userId));
    res.json({ success: true });
  }));

  router.post('/users/:id/balance', ah(async (req: any, res: any) => {
    const userId = parseInt(req.params.id, 10);
    const amount = Number(req.body.amount);
    const reason = req.body.reason || 'Admin adjustment';
    if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' });

    await db
      .update(users)
      .set({ balance: sql`${users.balance} + ${amount}`, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await db.insert(walletTransactions).values({
      userId,
      amount,
      type: 'admin_adjust',
      description: reason,
    });
    res.json({ success: true });
  }));

  // === Products ===
  router.get('/products', ah(async (_req: any, res: any) => {
    res.json(await db.select().from(products).orderBy(products.sortOrder));
  }));

  router.post('/products', ah(async (req: any, res: any) => {
    const { categoryId, inboundId, name, nameEn, description, price, volumeGb, durationDays, protocol } = req.body;
    if (!categoryId || !name || price == null) {
      return res.status(400).json({ error: 'categoryId, name, price required' });
    }
    const [product] = await db
      .insert(products)
      .values({
        categoryId,
        inboundId: inboundId || null,
        name,
        nameEn,
        description,
        price,
        volumeGb: volumeGb ?? 0,
        durationDays: durationDays ?? 30,
        protocol: protocol || 'vless',
      })
      .returning();
    res.json(product);
  }));

  router.put('/products/:id', ah(async (req: any, res: any) => {
    const id = parseInt(req.params.id, 10);
    const { name, nameEn, description, price, volumeGb, durationDays, isActive, sortOrder, inboundId, categoryId } =
      req.body;
    const [updated] = await db
      .update(products)
      .set({
        name,
        nameEn,
        description,
        price,
        volumeGb,
        durationDays,
        isActive,
        sortOrder,
        inboundId,
        categoryId,
      })
      .where(eq(products.id, id))
      .returning();
    res.json(updated);
  }));

  router.delete('/products/:id', ah(async (req: any, res: any) => {
    await db.delete(products).where(eq(products.id, parseInt(req.params.id, 10)));
    res.json({ success: true });
  }));

  // === Categories ===
  router.get('/categories', ah(async (_req: any, res: any) => {
    res.json(await db.select().from(categories).orderBy(categories.sortOrder));
  }));

  router.post('/categories', ah(async (req: any, res: any) => {
    const { name, nameEn, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const [cat] = await db
      .insert(categories)
      .values({ name, nameEn, sortOrder: sortOrder || 0 })
      .returning();
    res.json(cat);
  }));

  router.delete('/categories/:id', ah(async (req: any, res: any) => {
    await db.delete(categories).where(eq(categories.id, parseInt(req.params.id, 10)));
    res.json({ success: true });
  }));

  // === Orders ===
  router.get('/orders', ah(async (req: any, res: any) => {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const status = req.query.status as string | undefined;
    const limit = 20;
    const offset = (page - 1) * limit;

    let orderList;
    if (status) {
      orderList = await db
        .select()
        .from(orders)
        .where(eq(orders.status, status as any))
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      orderList = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
    }
    res.json(orderList);
  }));

  // === Payments ===
  router.get('/payments', ah(async (req: any, res: any) => {
    const status = req.query.status as string | undefined;
    let paymentList;
    if (status) {
      paymentList = await db
        .select()
        .from(payments)
        .where(eq(payments.status, status as any))
        .orderBy(desc(payments.createdAt))
        .limit(50);
    } else {
      paymentList = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(50);
    }
    res.json(paymentList);
  }));

  router.post('/payments/:id/approve', ah(async (req: any, res: any) => {
    const paymentId = parseInt(req.params.id, 10);
    const result = await confirmAndFulfillPayment(paymentId, true);
    if (!result.ok) return res.status(400).json({ error: 'Invalid or already processed payment' });
    res.json({ success: true, outcome: result.outcome?.type });
  }));

  router.post('/payments/:id/reject', ah(async (req: any, res: any) => {
    const paymentId = parseInt(req.params.id, 10);
    const result = await rejectPaymentAndNotify(paymentId);
    if (!result.ok) return res.status(400).json({ error: 'Invalid or already processed payment' });
    res.json({ success: true });
  }));

  // === Discounts ===
  router.get('/discounts', ah(async (_req: any, res: any) => {
    res.json(await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt)));
  }));

  router.post('/discounts', ah(async (req: any, res: any) => {
    const { code, percent, maxUses, expireAt } = req.body;
    if (!code || percent == null) return res.status(400).json({ error: 'code and percent required' });
    const [discount] = await db
      .insert(discountCodes)
      .values({
        code: String(code).trim().toUpperCase(),
        percent,
        maxUses: maxUses || 0,
        expireAt: expireAt ? new Date(expireAt) : null,
      })
      .returning();
    res.json(discount);
  }));

  router.delete('/discounts/:id', ah(async (req: any, res: any) => {
    await db.delete(discountCodes).where(eq(discountCodes.id, parseInt(req.params.id, 10)));
    res.json({ success: true });
  }));

  // === Gifts ===
  router.get('/gifts', ah(async (_req: any, res: any) => {
    res.json(await db.select().from(giftCodes).orderBy(desc(giftCodes.createdAt)));
  }));

  router.post('/gifts/generate', ah(async (req: any, res: any) => {
    const countNum = Math.min(100, Math.max(1, Number(req.body.count) || 1));
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount required' });
    const generated = [];
    for (let i = 0; i < countNum; i++) {
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
    for (const s of allSettings) {
      // Never expose password hash raw in a useful way — mask
      if (s.key === 'admin_password') {
        settingsMap[s.key] = s.value?.startsWith('scrypt$') ? '********' : s.value || '';
      } else {
        settingsMap[s.key] = s.value || '';
      }
    }
    res.json(settingsMap);
  }));

  router.put('/settings', ah(async (req: any, res: any) => {
    const entries = Object.entries(req.body) as [string, string][];
    for (const [key, value] of entries) {
      let storeValue = value;
      if (key === 'admin_password' && value && value !== '********' && !value.startsWith('scrypt$')) {
        storeValue = hashPassword(value);
      }
      if (key === 'admin_password' && value === '********') continue;

      const existing = await db.query.settings.findFirst({ where: eq(settings.key, key) });
      if (existing) {
        await db.update(settings).set({ value: storeValue, updatedAt: new Date() }).where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({ key, value: storeValue });
      }
    }
    res.json({ success: true });
  }));

  // === Messages ===
  router.get('/messages', ah(async (_req: any, res: any) => {
    res.json(await db.select().from(messages));
  }));

  router.put('/messages/:key', ah(async (req: any, res: any) => {
    const { faText, enText } = req.body;
    const existing = await db.query.messages.findFirst({ where: eq(messages.key, req.params.key) });
    if (existing) {
      await db.update(messages).set({ faText, enText, updatedAt: new Date() }).where(eq(messages.key, req.params.key));
    } else {
      await db.insert(messages).values({ key: req.params.key, faText, enText });
    }
    res.json({ success: true });
  }));

  // === Panels ===
  router.get('/panels', ah(async (_req: any, res: any) => {
    res.json(await db.select().from(panels));
  }));

  router.get('/panels/health', ah(async (_req: any, res: any) => {
    const result = await sanaeiClient.testConnection();
    res.json(result);
  }));

  router.post('/backup', ah(async (_req: any, res: any) => {
    res.json({ success: true, message: 'Use pg_dump externally; endpoint acknowledged' });
  }));

  return router;
}

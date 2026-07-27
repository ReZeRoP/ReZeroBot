import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, products, users, walletTransactions } from '../db/schema.js';
import { sanaeiClient } from '../panels/sanaei/client.js';
import { nanoid } from 'nanoid';
import type { Language } from '../i18n/index.js';

export interface CreateOrderParams {
  userId: number;
  productId: number;
  isTrial?: boolean;
  discountCode?: string;
  finalPrice: number;
}

export async function createOrder(params: CreateOrderParams) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, params.productId),
  });

  if (!product) throw new Error('Product not found');

  const email = `user_${nanoid(10)}`;
  const subId = nanoid(16);
  const now = Date.now();
  const expiryTime = params.isTrial
    ? now + 24 * 60 * 60 * 1000
    : now + product.durationDays * 24 * 60 * 60 * 1000;
  const totalGB = product.volumeGb > 0 ? product.volumeGb * 1024 * 1024 * 1024 : 0;

  // Create client on Sanaei panel
  const inboundId = product.inboundId || 1;
  await sanaeiClient.addClient({
    inboundId,
    email,
    totalGB,
    expiryTime,
    enable: true,
    subId,
  });

  const subLink = sanaeiClient.getSubscriptionUrl(subId);

  const [order] = await db
    .insert(orders)
    .values({
      userId: params.userId,
      productId: params.productId,
      status: 'active',
      usernameOnPanel: email,
      subLink,
      volumeGb: product.volumeGb,
      durationDays: product.durationDays,
      expireAt: new Date(expiryTime),
      isTrial: params.isTrial || false,
      discountCode: params.discountCode,
      finalPrice: params.finalPrice,
      activatedAt: new Date(),
    })
    .returning();

  return { order, email, subLink, inboundId };
}

export async function getUserOrders(userId: number) {
  return db.query.orders.findMany({
    where: eq(orders.userId, userId),
    orderBy: [desc(orders.createdAt)],
  });
}

export async function getActiveOrders(userId: number) {
  return db.query.orders.findMany({
    where: and(eq(orders.userId, userId), eq(orders.status, 'active')),
    orderBy: [desc(orders.createdAt)],
  });
}

export async function getOrderById(id: number) {
  return db.query.orders.findFirst({
    where: eq(orders.id, id),
  });
}

export async function renewOrder(orderId: number, days: number) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  const currentExpiry = order.expireAt ? order.expireAt.getTime() : Date.now();
  const newExpiry = Math.max(currentExpiry, Date.now()) + days * 24 * 60 * 60 * 1000;

  // Update on panel
  if (order.usernameOnPanel) {
    const client = await sanaeiClient.getClientByEmail(
      order.panelUserId || 1,
      order.usernameOnPanel,
    );
    if (client) {
      await sanaeiClient.updateClient({
        inboundId: order.panelUserId || 1,
        clientId: client.id,
        email: order.usernameOnPanel,
        totalGB: client.totalGB,
        expiryTime: newExpiry,
        enable: true,
      });
    }
  }

  const [updated] = await db
    .update(orders)
    .set({ expireAt: new Date(newExpiry), status: 'active' })
    .where(eq(orders.id, orderId))
    .returning();

  return updated;
}

export async function addVolumeToOrder(orderId: number, additionalGb: number) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  const newVolume = (order.volumeGb || 0) + additionalGb;
  const totalBytes = newVolume > 0 ? newVolume * 1024 * 1024 * 1024 : 0;

  if (order.usernameOnPanel) {
    const client = await sanaeiClient.getClientByEmail(
      order.panelUserId || 1,
      order.usernameOnPanel,
    );
    if (client) {
      await sanaeiClient.updateClient({
        inboundId: order.panelUserId || 1,
        clientId: client.id,
        email: order.usernameOnPanel,
        totalGB: totalBytes,
        expiryTime: client.expiryTime,
        enable: true,
      });
    }
  }

  const [updated] = await db
    .update(orders)
    .set({ volumeGb: newVolume })
    .where(eq(orders.id, orderId))
    .returning();

  return updated;
}

export async function purchaseWithWallet(
  userId: number,
  productId: number,
  finalPrice: number,
  lang: Language,
) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error('User not found');
  if (user.balance < finalPrice) throw new Error('Insufficient balance');

  // Deduct balance
  await db
    .update(users)
    .set({ balance: user.balance - finalPrice, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(walletTransactions).values({
    userId,
    amount: -finalPrice,
    type: 'purchase',
    description: `Purchase product #${productId}`,
  });

  // Create order
  return createOrder({ userId, productId, finalPrice });
}

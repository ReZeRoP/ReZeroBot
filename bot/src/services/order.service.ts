import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, products, users, walletTransactions } from '../db/schema.js';
import { sanaeiClient } from '../panels/sanaei/client.js';
import { nanoid } from 'nanoid';
import { config } from '../config.js';

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
    ? now + config.TRIAL_DAYS * 24 * 60 * 60 * 1000
    : now + product.durationDays * 24 * 60 * 60 * 1000;
  const volumeGb = params.isTrial ? config.TRIAL_VOLUME_GB : product.volumeGb;
  const totalGB = volumeGb > 0 ? volumeGb * 1024 * 1024 * 1024 : 0;

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
      panelUserId: inboundId,
      subLink,
      volumeGb,
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
    const inboundId = order.panelUserId || 1;
    const client = await sanaeiClient.getClientByEmail(inboundId, order.usernameOnPanel);
    if (!client) throw new Error(`Client ${order.usernameOnPanel} not found on panel inbound ${inboundId}`);
    const clientId = sanaeiClient.getClientIdentifier(client);
    await sanaeiClient.updateClient({
      inboundId,
      clientId,
      email: order.usernameOnPanel,
      totalGB: client.totalGB as number,
      expiryTime: newExpiry,
      enable: true,
    });
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
    const inboundId = order.panelUserId || 1;
    const client = await sanaeiClient.getClientByEmail(inboundId, order.usernameOnPanel);
    if (!client) throw new Error(`Client ${order.usernameOnPanel} not found on panel inbound ${inboundId}`);
    const clientId = sanaeiClient.getClientIdentifier(client);
    await sanaeiClient.updateClient({
      inboundId,
      clientId,
      email: order.usernameOnPanel,
      totalGB: totalBytes,
      expiryTime: client.expiryTime as number,
      enable: true,
    });
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
) {
  // 1. Atomic balance deduction (outside of long-running panel call)
  const [updated] = await db
    .update(users)
    .set({ balance: sql`${users.balance} - ${finalPrice}`, updatedAt: new Date() })
    .where(and(eq(users.id, userId), gte(users.balance, finalPrice)))
    .returning();

  if (!updated) throw new Error('Insufficient balance');

  // 2. Record wallet transaction
  await db.insert(walletTransactions).values({
    userId,
    amount: -finalPrice,
    type: 'purchase',
    description: `Purchase product #${productId}`,
  });

  // 3. Create order (makes HTTP call to panel)
  try {
    return await createOrder({ userId, productId, finalPrice });
  } catch (err) {
    // Refund balance on failure
    await db.update(users)
      .set({ balance: sql`${users.balance} + ${finalPrice}`, updatedAt: new Date() })
      .where(eq(users.id, userId));
    throw err;
  }
}

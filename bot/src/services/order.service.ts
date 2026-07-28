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

/** Resolve the 3x-ui inbound id from product (defaults to 1). */
export function resolvePanelInboundId(product: { inboundId?: number | null }): number {
  return product.inboundId && product.inboundId > 0 ? product.inboundId : 1;
}

export async function createOrder(params: CreateOrderParams) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, params.productId),
  });

  if (!product) throw new Error('Product not found');
  if (!params.isTrial && !product.isActive) throw new Error('Product is not active');

  const email = `user_${nanoid(10)}`;
  const subId = nanoid(16);
  const now = Date.now();
  const expiryTime = params.isTrial
    ? now + config.TRIAL_DAYS * 24 * 60 * 60 * 1000
    : now + product.durationDays * 24 * 60 * 60 * 1000;
  const volumeGb = params.isTrial ? config.TRIAL_VOLUME_GB : product.volumeGb;
  const totalGB = volumeGb > 0 ? volumeGb * 1024 * 1024 * 1024 : 0;
  const panelInboundId = resolvePanelInboundId(product);

  let clientCreated = false;
  let clientId: string | undefined;

  try {
    const created = await sanaeiClient.addClient({
      inboundId: panelInboundId,
      email,
      totalGB,
      expiryTime,
      enable: true,
      subId,
    });
    clientCreated = true;
    clientId = sanaeiClient.getClientIdentifier(created);

    const subLink = sanaeiClient.getSubscriptionUrl(subId);

    const [order] = await db
      .insert(orders)
      .values({
        userId: params.userId,
        productId: params.productId,
        status: 'active',
        usernameOnPanel: email,
        panelInboundId,
        panelUserId: panelInboundId, // legacy alias
        subLink,
        configLink: subLink,
        volumeGb,
        durationDays: params.isTrial ? config.TRIAL_DAYS : product.durationDays,
        expireAt: new Date(expiryTime),
        isTrial: params.isTrial || false,
        discountCode: params.discountCode,
        finalPrice: params.finalPrice,
        activatedAt: new Date(),
      })
      .returning();

    return { order, email, subLink, inboundId: panelInboundId };
  } catch (err) {
    // Best-effort cleanup of orphan panel client
    if (clientCreated) {
      try {
        if (clientId) {
          await sanaeiClient.removeClient(panelInboundId, clientId);
        }
      } catch (cleanupErr) {
        console.error('[ORDER] Failed to cleanup orphan panel client:', cleanupErr);
      }
    }
    throw err;
  }
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

function getOrderPanelInbound(order: { panelInboundId?: number | null; panelUserId?: number | null }) {
  return order.panelInboundId || order.panelUserId || 1;
}

export async function renewOrder(orderId: number, days: number) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  const currentExpiry = order.expireAt ? order.expireAt.getTime() : Date.now();
  const newExpiry = Math.max(currentExpiry, Date.now()) + days * 24 * 60 * 60 * 1000;

  if (order.usernameOnPanel) {
    const inboundId = getOrderPanelInbound(order);
    const client = await sanaeiClient.getClientByEmail(inboundId, order.usernameOnPanel);
    if (!client) throw new Error(`Client ${order.usernameOnPanel} not found on panel inbound ${inboundId}`);
    const clientId = sanaeiClient.getClientIdentifier(client);
    await sanaeiClient.updateClient({
      inboundId,
      clientId,
      email: order.usernameOnPanel,
      totalGB: (client.totalGB as number) || 0,
      expiryTime: newExpiry,
      enable: true,
    });
  }

  const [updated] = await db
    .update(orders)
    .set({
      expireAt: new Date(newExpiry),
      status: 'active',
      reminderSentAt: null,
    })
    .where(eq(orders.id, orderId))
    .returning();

  return updated;
}

export async function addVolumeToOrder(orderId: number, additionalGb: number) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');
  if (additionalGb <= 0) throw new Error('Invalid volume');

  const newVolume = (order.volumeGb || 0) + additionalGb;
  const totalBytes = newVolume > 0 ? newVolume * 1024 * 1024 * 1024 : 0;

  if (order.usernameOnPanel) {
    const inboundId = getOrderPanelInbound(order);
    const client = await sanaeiClient.getClientByEmail(inboundId, order.usernameOnPanel);
    if (!client) throw new Error(`Client ${order.usernameOnPanel} not found on panel inbound ${inboundId}`);
    const clientId = sanaeiClient.getClientIdentifier(client);
    await sanaeiClient.updateClient({
      inboundId,
      clientId,
      email: order.usernameOnPanel,
      totalGB: totalBytes,
      expiryTime: (client.expiryTime as number) || 0,
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

/** Atomically deduct balance if sufficient. Returns false if insufficient. */
export async function deductBalance(
  userId: number,
  amount: number,
  type: 'purchase' | 'admin_adjust',
  description: string,
): Promise<boolean> {
  if (amount <= 0) return true;

  const [updated] = await db
    .update(users)
    .set({ balance: sql`${users.balance} - ${amount}`, updatedAt: new Date() })
    .where(and(eq(users.id, userId), gte(users.balance, amount)))
    .returning();

  if (!updated) return false;

  await db.insert(walletTransactions).values({
    userId,
    amount: -amount,
    type,
    description,
  });

  return true;
}

/** Credit balance and record transaction (refund / charge). */
export async function creditBalance(
  userId: number,
  amount: number,
  type: 'charge' | 'refund' | 'gift' | 'referral' | 'admin_adjust',
  description: string,
) {
  if (amount <= 0) return;

  await db
    .update(users)
    .set({ balance: sql`${users.balance} + ${amount}`, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(walletTransactions).values({
    userId,
    amount,
    type,
    description,
  });
}

export async function purchaseWithWallet(
  userId: number,
  productId: number,
  finalPrice: number,
  discountCode?: string,
) {
  const ok = await deductBalance(userId, finalPrice, 'purchase', `Purchase product #${productId}`);
  if (!ok) throw new Error('Insufficient balance');

  try {
    return await createOrder({ userId, productId, finalPrice, discountCode });
  } catch (err) {
    await creditBalance(userId, finalPrice, 'refund', `Refund failed purchase product #${productId}`);
    throw err;
  }
}

/** Renew an order, charging wallet for product.price (or custom amount). */
export async function renewOrderWithWallet(userId: number, orderId: number, amount: number, days: number) {
  const order = await getOrderById(orderId);
  if (!order || order.userId !== userId) throw new Error('Order not found');

  const ok = await deductBalance(userId, amount, 'purchase', `Renew order #${orderId}`);
  if (!ok) throw new Error('Insufficient balance');

  try {
    return await renewOrder(orderId, days);
  } catch (err) {
    await creditBalance(userId, amount, 'refund', `Refund failed renew order #${orderId}`);
    throw err;
  }
}

/** Add volume, charging wallet. */
export async function addVolumeWithWallet(
  userId: number,
  orderId: number,
  additionalGb: number,
  amount: number,
) {
  const order = await getOrderById(orderId);
  if (!order || order.userId !== userId) throw new Error('Order not found');

  const ok = await deductBalance(userId, amount, 'purchase', `Add ${additionalGb}GB to order #${orderId}`);
  if (!ok) throw new Error('Insufficient balance');

  try {
    return await addVolumeToOrder(orderId, additionalGb);
  } catch (err) {
    await creditBalance(userId, amount, 'refund', `Refund failed volume order #${orderId}`);
    throw err;
  }
}

/** Disable a client on the panel when order expires. */
export async function disableOrderOnPanel(order: {
  id: number;
  usernameOnPanel?: string | null;
  panelInboundId?: number | null;
  panelUserId?: number | null;
}) {
  if (!order.usernameOnPanel) return;
  const inboundId = getOrderPanelInbound(order);
  try {
    const client = await sanaeiClient.getClientByEmail(inboundId, order.usernameOnPanel);
    if (!client) return;
    const clientId = sanaeiClient.getClientIdentifier(client);
    await sanaeiClient.updateClient({
      inboundId,
      clientId,
      email: order.usernameOnPanel,
      totalGB: (client.totalGB as number) || 0,
      expiryTime: (client.expiryTime as number) || 0,
      enable: false,
    });
  } catch (err) {
    console.error(`[ORDER] Failed to disable panel client for order #${order.id}:`, err);
  }
}

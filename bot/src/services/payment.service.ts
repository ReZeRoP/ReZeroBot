import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { payments, users, discountCodes } from '../db/schema.js';
import { createOrder, creditBalance } from './order.service.js';
import { Api } from 'grammy';
import { config } from '../config.js';
import { t, type Language } from '../i18n/index.js';

const tgApi = new Api(config.BOT_TOKEN);

export type PaymentPurpose = 'wallet_charge' | 'product_purchase';

export interface CreatePendingPaymentParams {
  userId: number;
  amount: number;
  gateway: 'card' | 'zarinpal' | 'aqayepardakht' | 'nowpayments' | 'plisio' | 'tronado' | 'iranpay' | 'wallet';
  purpose: PaymentPurpose;
  productId?: number;
  discountCode?: string;
  description?: string;
  refId?: string;
  authority?: string;
}

export async function createPendingPayment(params: CreatePendingPaymentParams) {
  const [payment] = await db
    .insert(payments)
    .values({
      userId: params.userId,
      amount: params.amount,
      gateway: params.gateway,
      purpose: params.purpose,
      productId: params.productId,
      discountCode: params.discountCode,
      description: params.description,
      refId: params.refId || params.authority,
      authority: params.authority,
      status: 'pending',
    })
    .returning();
  return payment;
}

/**
 * Atomically mark payment confirmed. Returns null if already processed.
 */
export async function markPaymentConfirmed(paymentId: number) {
  const [updated] = await db
    .update(payments)
    .set({ status: 'confirmed', paidAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')))
    .returning();
  return updated || null;
}

export async function markPaymentRejected(paymentId: number) {
  const [updated] = await db
    .update(payments)
    .set({ status: 'rejected' })
    .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')))
    .returning();
  return updated || null;
}

/** Apply discount code usage after successful payment (best-effort). */
async function consumeDiscount(code?: string | null) {
  if (!code) return;
  await db
    .update(discountCodes)
    .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
    .where(and(eq(discountCodes.code, code), eq(discountCodes.isActive, true)));
}

/**
 * Fulfill a confirmed payment: either credit wallet or create product order.
 * Call only AFTER markPaymentConfirmed succeeded.
 */
export async function fulfillPayment(payment: typeof payments.$inferSelect) {
  const purpose = (payment.purpose || 'wallet_charge') as PaymentPurpose;
  let productId = payment.productId ?? null;

  // Backward compat: parse "Product #N" from description
  if (!productId && payment.description) {
    const m = payment.description.match(/Product #(\d+)/i);
    if (m) productId = parseInt(m[1], 10);
  }

  const treatAsProduct =
    purpose === 'product_purchase' ||
    (!!productId && /Product #/i.test(payment.description || ''));

  if (treatAsProduct && productId) {
    const pid = productId;
    try {
      const result = await createOrder({
        userId: payment.userId,
        productId: pid,
        finalPrice: payment.amount,
        discountCode: payment.discountCode || undefined,
      });
      await db.update(payments).set({ orderId: result.order.id, productId: pid }).where(eq(payments.id, payment.id));
      await consumeDiscount(payment.discountCode);
      return { type: 'product' as const, result };
    } catch (err) {
      // Fallback: credit wallet so user is not out of money
      console.error(`[PAYMENT] Product fulfillment failed for #${payment.id}, crediting wallet:`, err);
      await creditBalance(
        payment.userId,
        payment.amount,
        'charge',
        `Fallback credit for payment #${payment.id} (product create failed)`,
      );
      return { type: 'wallet_fallback' as const, error: err };
    }
  }

  // Wallet charge
  await creditBalance(payment.userId, payment.amount, 'charge', `Payment #${payment.id} confirmed`);
  await consumeDiscount(payment.discountCode);
  return { type: 'wallet' as const };
}

/** Confirm + fulfill + notify user. Idempotent. */
export async function confirmAndFulfillPayment(paymentId: number, notify = true) {
  const confirmed = await markPaymentConfirmed(paymentId);
  if (!confirmed) {
    return { ok: false as const, reason: 'already_processed' as const };
  }

  const outcome = await fulfillPayment(confirmed);

  if (notify) {
    try {
      const user = await db.query.users.findFirst({ where: eq(users.id, confirmed.userId) });
      if (user) {
        const lang = (user.language || 'fa') as Language;
        if (outcome.type === 'product' && outcome.result) {
          await tgApi.sendMessage(
            user.telegramId,
            `${t(lang, 'payment_approved')}\n\n${t(lang, 'config_created', {
              username: outcome.result.email,
              volume: String(outcome.result.order.volumeGb),
              expiry: outcome.result.order.expireAt?.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US') || '-',
              config: outcome.result.subLink,
              sub: outcome.result.subLink,
            })}`,
          );
        } else {
          await tgApi.sendMessage(user.telegramId, t(lang, 'payment_approved'));
        }
      }
    } catch {
      /* user may have blocked bot */
    }
  }

  return { ok: true as const, outcome, payment: confirmed };
}

export async function rejectPaymentAndNotify(paymentId: number) {
  const rejected = await markPaymentRejected(paymentId);
  if (!rejected) return { ok: false as const, reason: 'already_processed' as const };

  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, rejected.userId) });
    if (user) {
      const lang = (user.language || 'fa') as Language;
      await tgApi.sendMessage(user.telegramId, t(lang, 'payment_rejected'));
    }
  } catch {
    /* */
  }

  return { ok: true as const };
}

/** Validate discount and return final price (does NOT consume). */
export async function applyDiscountPreview(code: string | undefined, basePrice: number) {
  if (!code) return { finalPrice: basePrice, discountCode: undefined as string | undefined, percent: 0 };

  const discount = await db.query.discountCodes.findFirst({
    where: eq(discountCodes.code, code.trim()),
  });

  if (!discount || !discount.isActive) throw new Error('Invalid discount code');
  if (discount.expireAt && discount.expireAt < new Date()) throw new Error('Discount code expired');
  if (discount.maxUses && discount.maxUses > 0 && discount.usedCount >= discount.maxUses) {
    throw new Error('Discount code used up');
  }

  const percent = Math.min(Math.max(discount.percent, 0), 100);
  const finalPrice = Math.round(basePrice * (1 - percent / 100));
  return { finalPrice, discountCode: discount.code, percent };
}

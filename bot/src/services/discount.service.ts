import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { discountCodes, giftCodes, users, walletTransactions } from '../db/schema.js';

export async function validateDiscountCode(code: string) {
  const discount = await db.query.discountCodes.findFirst({
    where: eq(discountCodes.code, code.trim()),
  });

  if (!discount || !discount.isActive) return null;
  if (discount.expireAt && discount.expireAt < new Date()) return null;
  if (discount.maxUses && discount.maxUses > 0 && discount.usedCount >= discount.maxUses) return null;
  return discount;
}

export function priceAfterDiscount(basePrice: number, percent: number) {
  const p = Math.min(Math.max(percent, 0), 100);
  return Math.round(basePrice * (1 - p / 100));
}

/** Redeem a gift code atomically. Throws on failure. */
export async function redeemGiftCode(userId: number, rawCode: string) {
  const code = rawCode.trim().toUpperCase();

  const [gift] = await db
    .update(giftCodes)
    .set({
      isUsed: true,
      usedBy: userId,
      usedAt: new Date(),
    })
    .where(and(eq(giftCodes.code, code), eq(giftCodes.isUsed, false)))
    .returning();

  if (!gift) throw new Error('Invalid or already used gift code');

  await db
    .update(users)
    .set({ balance: sql`${users.balance} + ${gift.amount}`, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(walletTransactions).values({
    userId,
    amount: gift.amount,
    type: 'gift',
    description: `Gift code ${gift.code}`,
  });

  return gift;
}

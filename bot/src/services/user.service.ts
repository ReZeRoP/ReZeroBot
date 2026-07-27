import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, referrals, walletTransactions } from '../db/schema.js';
import { nanoid } from 'nanoid';
import { config } from '../config.js';
import type { Language } from '../i18n/index.js';

export interface TelegramUserInfo {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export async function getOrCreateUser(info: TelegramUserInfo, refCode?: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.telegramId, info.telegramId),
  });

  if (existing) {
    // Update user info
    await db
      .update(users)
      .set({
        username: info.username || existing.username,
        firstName: info.firstName || existing.firstName,
        lastName: info.lastName || existing.lastName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));

    return { user: existing, isNew: false };
  }

  // Create new user
  const newRefCode = nanoid(8);
  let referredBy: number | null = null;

  if (refCode && config.REFERRAL_ENABLED) {
    const referrer = await db.query.users.findFirst({
      where: eq(users.refCode, refCode),
    });
    if (referrer && referrer.telegramId !== info.telegramId) {
      referredBy = referrer.id;
    }
  }

  let newUser;
  try {
    [newUser] = await db
      .insert(users)
      .values({
        telegramId: info.telegramId,
        username: info.username,
        firstName: info.firstName,
        lastName: info.lastName,
        refCode: newRefCode,
        referredBy,
        balance: 0,
        language: 'fa',
      })
      .returning();
  } catch {
    // Concurrent insert — user already exists, fetch and return
    const raced = await db.query.users.findFirst({
      where: eq(users.telegramId, info.telegramId),
    });
    return { user: raced!, isNew: false };
  }

  // Process referral reward
  if (referredBy && config.REFERRAL_ENABLED) {
    await db.insert(referrals).values({
      referrerId: referredBy,
      referredId: newUser.id,
      rewardAmount: config.REFERRAL_REWARD,
    });

    // Credit referrer atomically (increment, not overwrite)
    await db
      .update(users)
      .set({ balance: sql`${users.balance} + ${config.REFERRAL_REWARD}`, updatedAt: new Date() })
      .where(eq(users.id, referredBy));

    await db.insert(walletTransactions).values({
      userId: referredBy,
      amount: config.REFERRAL_REWARD,
      type: 'referral',
      description: `Referral reward: ${info.firstName || info.telegramId}`,
    });
  }

  return { user: newUser, isNew: true };
}

export async function getUserByTelegramId(telegramId: number) {
  return db.query.users.findFirst({
    where: eq(users.telegramId, telegramId),
  });
}

export async function getUserById(id: number) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}

export async function updateUserLanguage(userId: number, language: Language) {
  await db.update(users).set({ language, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserBalance(userId: number, amount: number) {
  const [updated] = await db
    .update(users)
    .set({ balance: sql`${users.balance} + ${amount}`, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  return updated || null;
}

export async function isUserBlocked(telegramId: number): Promise<boolean> {
  const user = await getUserByTelegramId(telegramId);
  return user?.isBlocked ?? false;
}

export async function getReferralStats(userId: number) {
  const referralList = await db.query.referrals.findMany({
    where: eq(referrals.referrerId, userId),
  });

  const totalEarnings = referralList.reduce((sum, r) => sum + r.rewardAmount, 0);

  return {
    count: referralList.length,
    earnings: totalEarnings,
  };
}

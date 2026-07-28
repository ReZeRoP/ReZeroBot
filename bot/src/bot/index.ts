import { Bot, Context, session, SessionFlavor } from 'grammy';
import { config, adminIds } from '../config.js';
import { t, type Language } from '../i18n/index.js';
import { getOrCreateUser, getUserByTelegramId, getReferralStats, updateUserLanguage } from '../services/user.service.js';
import {
  mainMenuKeyboard,
  languageKeyboard,
  categoryKeyboard,
  productKeyboard,
  confirmPurchaseKeyboard,
  paymentMethodKeyboard,
  serviceActionsKeyboard,
  walletKeyboard,
  accountKeyboard,
  supportKeyboard,
  trialKeyboard,
  backToMenuKeyboard,
  channelCheckKeyboard,
} from './keyboards.js';
import { getActiveCategories, getProductsByCategory, getProductById } from '../services/product.service.js';
import {
  getActiveOrders,
  purchaseWithWallet,
  getOrderById,
  createOrder,
  renewOrderWithWallet,
  addVolumeWithWallet,
} from '../services/order.service.js';
import { formatPrice, formatVolume, formatDuration } from '../i18n/index.js';
import { db } from '../db/index.js';
import { payments, trials, products, walletTransactions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { zarinpalRequest, nowpaymentsRequest } from '../payments/index.js';
import { createPendingPayment, confirmAndFulfillPayment, rejectPaymentAndNotify } from '../services/payment.service.js';
import { validateDiscountCode, priceAfterDiscount, redeemGiftCode } from '../services/discount.service.js';
import { createRedisSessionStorage } from '../db/redis.js';

interface SessionData {
  step?: string;
  selectedProduct?: number;
  selectedCategory?: number;
  pendingPayment?: number;
  discountCode?: string;
}

type BotContext = Context & SessionFlavor<SessionData>;

async function answer(ctx: BotContext, text?: string, showAlert = false) {
  try {
    await ctx.answerCallbackQuery(text ? { text, show_alert: showAlert } : undefined);
  } catch {
    /* already answered or too old */
  }
}

export function createBot() {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  bot.use(
    session({
      initial: (): SessionData => ({}),
      storage: createRedisSessionStorage<SessionData>(),
    }),
  );

  async function checkChannelMembership(ctx: BotContext, telegramId: number): Promise<boolean> {
    if (!config.CHANNEL_ENABLED || !config.CHANNEL_ID) return true;
    try {
      const member = await ctx.api.getChatMember(config.CHANNEL_ID, telegramId);
      return ['member', 'administrator', 'creator'].includes(member.status);
    } catch {
      // Fail closed when channel is required but check fails? Prefer open to avoid lockouts.
      console.error('[BOT] Channel membership check failed');
      return true;
    }
  }

  // === /start ===
  bot.command('start', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const payload = ctx.match?.trim();
    const refCode = payload && payload.length > 0 ? payload : undefined;

    const { user, isNew } = await getOrCreateUser(
      {
        telegramId,
        username: ctx.from!.username,
        firstName: ctx.from!.first_name,
        lastName: ctx.from!.last_name,
      },
      refCode,
    );

    if (user.isBlocked) {
      return ctx.reply(t(user.language as Language, 'error_blocked'));
    }

    const lang = user.language as Language;

    if (isNew) {
      return ctx.reply(t('fa', 'welcome'), { reply_markup: languageKeyboard() });
    }

    await ctx.reply(t(lang, 'welcomeBack', { name: ctx.from!.first_name || 'User' }), {
      reply_markup: mainMenuKeyboard(lang),
    });
  });

  bot.command('help', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    const lang = (user?.language || 'fa') as Language;
    await ctx.reply(t(lang, 'support_menu'), { reply_markup: supportKeyboard(lang) });
  });

  bot.command('skip', async (ctx) => {
    if (ctx.session.step === 'awaiting_discount') {
      ctx.session.step = undefined;
      ctx.session.discountCode = undefined;
      const user = await getUserByTelegramId(ctx.from?.id || 0);
      if (!user) return;
      const lang = user.language as Language;
      return ctx.reply(t(lang, 'payment_select_method'), {
        reply_markup: paymentMethodKeyboard(lang, user.balance),
      });
    }
  });

  // === Text messages ===
  bot.on('message:text', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    if (!user) return;
    if (user.isBlocked) return ctx.reply(t(user.language as Language, 'error_blocked'));

    const lang = user.language as Language;
    const text = ctx.message.text;

    if (ctx.session.step === 'awaiting_charge_amount') {
      ctx.session.step = undefined;
      const amount = parseInt(text.replace(/[,،\s]/g, ''), 10);
      if (isNaN(amount) || amount < 1000) {
        return ctx.reply(t(lang, 'error_generic'), { reply_markup: mainMenuKeyboard(lang) });
      }

      const payment = await createPendingPayment({
        userId: user.id,
        gateway: 'card',
        amount,
        purpose: 'wallet_charge',
        description: `Wallet charge: ${amount}`,
      });

      ctx.session.step = 'awaiting_receipt';
      ctx.session.pendingPayment = payment.id;

      return ctx.reply(
        t(lang, 'payment_card_info', {
          amount: amount.toLocaleString(),
          card: config.CARD_NUMBER,
          holder: config.CARD_HOLDER,
        }),
      );
    }

    if (ctx.session.step === 'awaiting_support_msg') {
      ctx.session.step = undefined;
      for (const adminId of adminIds) {
        try {
          await ctx.api.sendMessage(
            adminId,
            `📩 Support from ${ctx.from.first_name} (@${ctx.from.username || user.telegramId}):\n\n${text}`,
          );
        } catch {
          /* */
        }
      }
      return ctx.reply(t(lang, 'support_sent'), { reply_markup: mainMenuKeyboard(lang) });
    }

    if (ctx.session.step === 'awaiting_discount') {
      ctx.session.step = undefined;
      const trimmed = text.trim();
      if (trimmed === '➖' || trimmed.toLowerCase() === 'skip' || trimmed === '/skip') {
        ctx.session.discountCode = undefined;
      } else {
        const code = await validateDiscountCode(trimmed);
        if (!code) {
          return ctx.reply(t(lang, 'discount_invalid'), { reply_markup: mainMenuKeyboard(lang) });
        }
        ctx.session.discountCode = code.code;
        await ctx.reply(t(lang, 'discount_applied', { percent: code.percent }));
      }
      return ctx.reply(t(lang, 'payment_select_method'), {
        reply_markup: paymentMethodKeyboard(lang, user.balance),
      });
    }

    if (ctx.session.step === 'awaiting_gift') {
      ctx.session.step = undefined;
      try {
        const gift = await redeemGiftCode(user.id, text);
        return ctx.reply(t(lang, 'gift_redeemed', { amount: gift.amount.toLocaleString() }), {
          reply_markup: mainMenuKeyboard(lang),
        });
      } catch {
        return ctx.reply(t(lang, 'gift_invalid'), { reply_markup: mainMenuKeyboard(lang) });
      }
    }

    if (text === t(lang, 'menu_shop')) {
      if (!(await checkChannelMembership(ctx, ctx.from!.id))) {
        return ctx.reply(t(lang, 'channel_required'), { reply_markup: channelCheckKeyboard(lang) });
      }
      const cats = await getActiveCategories();
      if (cats.length === 0) return ctx.reply(t(lang, 'shop_no_products'));
      return ctx.reply(t(lang, 'shop_select_category'), {
        reply_markup: categoryKeyboard(cats, lang),
      });
    }

    if (text === t(lang, 'menu_services')) {
      const orders = await getActiveOrders(user.id);
      if (orders.length === 0) return ctx.reply(t(lang, 'services_empty'));

      for (const order of orders.slice(0, 5)) {
        const product = await getProductById(order.productId);
        const name = product ? (lang === 'fa' ? product.name : product.nameEn || product.name) : `#${order.id}`;
        const status = order.status === 'active' ? '✅' : '⏳';
        await ctx.reply(`• ${name} | ${status}`, {
          reply_markup: serviceActionsKeyboard(order.id, lang),
        });
      }
      return;
    }

    if (text === t(lang, 'menu_wallet')) {
      return ctx.reply(t(lang, 'wallet_balance', { balance: user.balance.toLocaleString() }), {
        reply_markup: walletKeyboard(lang),
      });
    }

    if (text === t(lang, 'menu_account')) {
      const date = user.createdAt.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US');
      return ctx.reply(
        t(lang, 'account_info', {
          id: user.telegramId,
          name: user.firstName || 'User',
          balance: user.balance.toLocaleString(),
          date,
          ref: user.refCode,
        }),
        { reply_markup: accountKeyboard(lang) },
      );
    }

    if (text === t(lang, 'menu_support')) {
      return ctx.reply(t(lang, 'support_menu'), { reply_markup: supportKeyboard(lang) });
    }

    if (text === t(lang, 'menu_trial')) {
      if (!config.TRIAL_ENABLED) return ctx.reply(t(lang, 'trial_disabled'));
      return ctx.reply(
        t(lang, 'trial_available', { days: config.TRIAL_DAYS, volume: config.TRIAL_VOLUME_GB }),
        { reply_markup: trialKeyboard(lang) },
      );
    }
  });

  // === Callbacks ===
  bot.on('callback_query:data', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    if (!user) return answer(ctx);
    if (user.isBlocked) {
      await answer(ctx, t(user.language as Language, 'error_blocked'), true);
      return;
    }

    const lang = user.language as Language;
    const data = ctx.callbackQuery.data;

    try {
      if (data.startsWith('lang:')) {
        const newLang = data.split(':')[1] as Language;
        await updateUserLanguage(user.id, newLang);
        await answer(ctx);
        return ctx.reply(t(newLang, 'welcomeBack', { name: ctx.from.first_name || 'User' }), {
          reply_markup: mainMenuKeyboard(newLang),
        });
      }

      if (data === 'check:channel') {
        if (await checkChannelMembership(ctx, ctx.from.id)) {
          await answer(ctx, t(lang, 'channel_joined'));
          const cats = await getActiveCategories();
          return ctx.reply(t(lang, 'shop_select_category'), { reply_markup: categoryKeyboard(cats, lang) });
        }
        return answer(ctx, t(lang, 'channel_not_joined'), true);
      }

      if (data.startsWith('cat:')) {
        const catId = parseInt(data.split(':')[1], 10);
        ctx.session.selectedCategory = catId;
        const prods = await getProductsByCategory(catId);
        await answer(ctx);
        if (prods.length === 0) return ctx.reply(t(lang, 'shop_no_products'));
        return ctx.reply(t(lang, 'shop_select_product'), {
          reply_markup: productKeyboard(prods, lang),
        });
      }

      if (data.startsWith('prod:')) {
        const prodId = parseInt(data.split(':')[1], 10);
        ctx.session.selectedProduct = prodId;
        const product = await getProductById(prodId);
        await answer(ctx);
        if (!product) return ctx.reply(t(lang, 'error_not_found'));

        const name = lang === 'fa' ? product.name : product.nameEn || product.name;
        return ctx.reply(
          t(lang, 'shop_product_info', {
            name,
            price: formatPrice(product.price, lang),
            volume: formatVolume(product.volumeGb, lang),
            duration: formatDuration(product.durationDays, lang),
          }),
          { reply_markup: confirmPurchaseKeyboard(lang) },
        );
      }

      if (data === 'buy:confirm') {
        const prodId = ctx.session.selectedProduct;
        await answer(ctx);
        if (!prodId) return ctx.reply(t(lang, 'error_generic'));
        ctx.session.step = 'awaiting_discount';
        return ctx.reply(t(lang, 'discount_enter'));
      }

      if (data === 'buy:cancel') {
        ctx.session.selectedProduct = undefined;
        ctx.session.discountCode = undefined;
        ctx.session.step = undefined;
        await answer(ctx);
        return ctx.reply(t(lang, 'back_to_menu'), { reply_markup: mainMenuKeyboard(lang) });
      }

      // --- Pay with wallet ---
      if (data === 'pay:wallet') {
        const prodId = ctx.session.selectedProduct;
        await answer(ctx);
        if (!prodId) return ctx.reply(t(lang, 'error_generic'));

        const product = await getProductById(prodId);
        if (!product) return ctx.reply(t(lang, 'error_not_found'));

        let finalPrice = product.price;
        const disc = ctx.session.discountCode
          ? await validateDiscountCode(ctx.session.discountCode)
          : null;
        if (disc) finalPrice = priceAfterDiscount(product.price, disc.percent);

        if (user.balance < finalPrice) {
          return ctx.reply(
            t(lang, 'payment_insufficient', {
              balance: user.balance.toLocaleString(),
              required: finalPrice.toLocaleString(),
            }),
          );
        }

        try {
          const result = await purchaseWithWallet(user.id, prodId, finalPrice, ctx.session.discountCode);
          // Consume discount only after success
          if (disc) {
            const { sql } = await import('drizzle-orm');
            const { discountCodes } = await import('../db/schema.js');
            await db
              .update(discountCodes)
              .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
              .where(eq(discountCodes.id, disc.id));
          }
          ctx.session.selectedProduct = undefined;
          ctx.session.discountCode = undefined;

          return ctx.reply(
            t(lang, 'config_created', {
              username: result.email,
              volume: formatVolume(product.volumeGb, lang),
              expiry: result.order.expireAt?.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US') || '-',
              config: result.subLink,
              sub: result.subLink,
            }),
            { reply_markup: mainMenuKeyboard(lang) },
          );
        } catch {
          return ctx.reply(t(lang, 'error_generic'));
        }
      }

      // --- Pay with card ---
      if (data === 'pay:card') {
        const prodId = ctx.session.selectedProduct;
        await answer(ctx);
        if (!prodId) return ctx.reply(t(lang, 'error_generic'));
        const product = await getProductById(prodId);
        if (!product) return ctx.reply(t(lang, 'error_not_found'));

        let finalPrice = product.price;
        if (ctx.session.discountCode) {
          const code = await validateDiscountCode(ctx.session.discountCode);
          if (code) finalPrice = priceAfterDiscount(product.price, code.percent);
        }

        const payment = await createPendingPayment({
          userId: user.id,
          gateway: 'card',
          amount: finalPrice,
          purpose: 'product_purchase',
          productId: prodId,
          discountCode: ctx.session.discountCode,
          description: `Product #${prodId}`,
        });

        ctx.session.step = 'awaiting_receipt';
        ctx.session.pendingPayment = payment.id;

        return ctx.reply(
          t(lang, 'payment_card_info', {
            amount: finalPrice.toLocaleString(),
            card: config.CARD_NUMBER,
            holder: config.CARD_HOLDER,
          }),
        );
      }

      // --- Zarinpal ---
      if (data === 'pay:zarinpal') {
        const prodId = ctx.session.selectedProduct;
        await answer(ctx);
        if (!prodId) return ctx.reply(t(lang, 'error_generic'));
        const product = await getProductById(prodId);
        if (!product) return ctx.reply(t(lang, 'error_not_found'));
        if (!config.ZARINPAL_MERCHANT_ID) return ctx.reply(t(lang, 'error_generic'));

        let finalPrice = product.price;
        if (ctx.session.discountCode) {
          const code = await validateDiscountCode(ctx.session.discountCode);
          if (code) finalPrice = priceAfterDiscount(product.price, code.percent);
        }

        try {
          const result = await zarinpalRequest({
            amount: finalPrice,
            userId: user.id,
            description: `Product #${prodId}`,
          });
          if (!result.success || !result.paymentUrl) return ctx.reply(t(lang, 'error_generic'));

          const payment = await createPendingPayment({
            userId: user.id,
            gateway: 'zarinpal',
            amount: finalPrice,
            purpose: 'product_purchase',
            productId: prodId,
            discountCode: ctx.session.discountCode,
            description: `Product #${prodId}`,
            authority: result.authority,
            refId: result.authority,
          });

          ctx.session.pendingPayment = payment.id;
          return ctx.reply(t(lang, 'payment_online_link'), {
            reply_markup: {
              inline_keyboard: [[{ text: t(lang, 'payment_pay_button'), url: result.paymentUrl }]],
            },
          });
        } catch {
          return ctx.reply(t(lang, 'error_generic'));
        }
      }

      // --- NowPayments ---
      if (data === 'pay:nowpayments') {
        const prodId = ctx.session.selectedProduct;
        await answer(ctx);
        if (!prodId) return ctx.reply(t(lang, 'error_generic'));
        const product = await getProductById(prodId);
        if (!product) return ctx.reply(t(lang, 'error_not_found'));
        if (!config.NOWPAYMENTS_API_KEY) return ctx.reply(t(lang, 'error_generic'));

        let finalPrice = product.price;
        if (ctx.session.discountCode) {
          const code = await validateDiscountCode(ctx.session.discountCode);
          if (code) finalPrice = priceAfterDiscount(product.price, code.percent);
        }

        try {
          const result = await nowpaymentsRequest({
            amount: finalPrice,
            userId: user.id,
            description: `Product #${prodId}`,
          });
          if (!result.success || !result.paymentUrl) return ctx.reply(t(lang, 'error_generic'));

          await createPendingPayment({
            userId: user.id,
            gateway: 'nowpayments',
            amount: finalPrice,
            purpose: 'product_purchase',
            productId: prodId,
            discountCode: ctx.session.discountCode,
            description: `Product #${prodId}`,
            refId: result.refId,
          });

          return ctx.reply(t(lang, 'payment_online_link'), {
            reply_markup: {
              inline_keyboard: [[{ text: t(lang, 'payment_pay_button'), url: result.paymentUrl }]],
            },
          });
        } catch {
          return ctx.reply(t(lang, 'error_generic'));
        }
      }

      // --- Service actions ---
      if (data.startsWith('svc:')) {
        const [, action, idStr] = data.split(':');
        const orderId = parseInt(idStr, 10);
        const order = await getOrderById(orderId);
        await answer(ctx);
        if (!order || order.userId !== user.id) return ctx.reply(t(lang, 'error_not_found'));

        if (action === 'config' || action === 'sub') {
          return ctx.reply(`🔗 ${order.subLink || order.configLink || 'N/A'}`);
        }

        if (action === 'renew') {
          const product = await getProductById(order.productId);
          if (!product) return ctx.reply(t(lang, 'error_not_found'));
          if (user.balance < product.price) {
            return ctx.reply(
              t(lang, 'payment_insufficient', {
                balance: user.balance.toLocaleString(),
                required: product.price.toLocaleString(),
              }),
            );
          }
          try {
            await renewOrderWithWallet(user.id, orderId, product.price, product.durationDays);
            return ctx.reply(t(lang, 'service_renewed'), { reply_markup: mainMenuKeyboard(lang) });
          } catch {
            return ctx.reply(t(lang, 'error_generic'));
          }
        }

        if (action === 'volume') {
          const gb = 10;
          const price = config.VOLUME_GB_PRICE * gb;
          if (price <= 0) {
            return ctx.reply(t(lang, 'service_volume') + ' - ' + t(lang, 'support_contact'), {
              reply_markup: backToMenuKeyboard(lang),
            });
          }
          if (user.balance < price) {
            return ctx.reply(
              t(lang, 'payment_insufficient', {
                balance: user.balance.toLocaleString(),
                required: price.toLocaleString(),
              }),
            );
          }
          try {
            await addVolumeWithWallet(user.id, orderId, gb, price);
            return ctx.reply(t(lang, 'service_renewed'), { reply_markup: mainMenuKeyboard(lang) });
          } catch {
            return ctx.reply(t(lang, 'error_generic'));
          }
        }
      }

      // --- Wallet ---
      if (data === 'wallet:charge') {
        ctx.session.step = 'awaiting_charge_amount';
        await answer(ctx);
        return ctx.reply(t(lang, 'wallet_charge_amount'));
      }

      if (data === 'wallet:history') {
        await answer(ctx);
        const txs = await db.query.walletTransactions.findMany({
          where: eq(walletTransactions.userId, user.id),
          orderBy: [desc(walletTransactions.createdAt)],
          limit: 10,
        });
        if (txs.length === 0) {
          return ctx.reply(t(lang, 'wallet_empty_history'), { reply_markup: backToMenuKeyboard(lang) });
        }
        let msg = '';
        for (const tx of txs) {
          const sign = tx.amount > 0 ? '+' : '';
          msg += `${sign}${tx.amount.toLocaleString()} | ${tx.type} | ${tx.createdAt.toLocaleDateString()}\n`;
        }
        return ctx.reply(msg, { reply_markup: backToMenuKeyboard(lang) });
      }

      if (data === 'wallet:gift') {
        ctx.session.step = 'awaiting_gift';
        await answer(ctx);
        return ctx.reply(t(lang, 'gift_enter'));
      }

      // --- Account ---
      if (data === 'account:referral') {
        await answer(ctx);
        const stats = await getReferralStats(user.id);
        const link = `https://t.me/${config.BOT_USERNAME}?start=${user.refCode}`;
        return ctx.reply(
          t(lang, 'account_referral', {
            link,
            count: stats.count,
            earnings: stats.earnings.toLocaleString(),
          }),
          { reply_markup: backToMenuKeyboard(lang) },
        );
      }

      if (data === 'account:language') {
        await answer(ctx);
        return ctx.reply(t(lang, 'account_language'), { reply_markup: languageKeyboard() });
      }

      if (data === 'support:faq') {
        await answer(ctx);
        return ctx.reply(t(lang, 'support_faq', { faq: '1. How to connect?\n2. How to renew?' }), {
          reply_markup: backToMenuKeyboard(lang),
        });
      }

      if (data === 'support:contact') {
        ctx.session.step = 'awaiting_support_msg';
        await answer(ctx);
        return ctx.reply(t(lang, 'support_contact'));
      }

      // --- Trial ---
      if (data === 'trial:confirm') {
        await answer(ctx);
        if (!config.TRIAL_ENABLED) return ctx.reply(t(lang, 'trial_disabled'));

        const existingTrial = await db.query.trials.findFirst({ where: eq(trials.userId, user.id) });
        if (existingTrial) return ctx.reply(t(lang, 'trial_used'));

        try {
          const trialProduct = await db.query.products.findFirst({ where: eq(products.isActive, true) });
          if (!trialProduct) return ctx.reply(t(lang, 'error_generic'));

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
            // Unique violation = already used (race)
            return ctx.reply(t(lang, 'trial_used'));
          }

          return ctx.reply(
            t(lang, 'trial_created', {
              days: config.TRIAL_DAYS,
              volume: config.TRIAL_VOLUME_GB,
              config: result.subLink,
            }),
            { reply_markup: mainMenuKeyboard(lang) },
          );
        } catch {
          return ctx.reply(t(lang, 'error_generic'));
        }
      }

      if (data === 'menu:main') {
        ctx.session.step = undefined;
        await answer(ctx);
        return ctx.reply(t(lang, 'welcomeBack', { name: ctx.from.first_name || 'User' }), {
          reply_markup: mainMenuKeyboard(lang),
        });
      }

      if (data === 'shop:back') {
        await answer(ctx);
        const cats = await getActiveCategories();
        return ctx.reply(t(lang, 'shop_select_category'), {
          reply_markup: categoryKeyboard(cats, lang),
        });
      }

      await answer(ctx);
    } catch (err) {
      console.error('[BOT] callback error:', err);
      await answer(ctx, t(lang, 'error_generic'), true);
    }
  });

  // === Photo (receipt) ===
  bot.on('message:photo', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    if (!user) return;
    const lang = user.language as Language;

    if (ctx.session.step === 'awaiting_receipt') {
      const paymentId = ctx.session.pendingPayment;
      ctx.session.step = undefined;
      ctx.session.pendingPayment = undefined;

      if (paymentId) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await db.update(payments).set({ receiptPhoto: photo.file_id }).where(eq(payments.id, paymentId));

        for (const adminId of adminIds) {
          try {
            await ctx.api.sendPhoto(adminId, photo.file_id, {
              caption: `💳 Receipt from ${ctx.from.first_name} (@${ctx.from.username || user.telegramId})\nPayment #${paymentId}\nUse /approve_${paymentId} or /reject_${paymentId}`,
            });
          } catch {
            /* */
          }
        }
      }

      return ctx.reply(t(lang, 'payment_receipt_sent'), {
        reply_markup: mainMenuKeyboard(lang),
      });
    }
  });

  // === Admin approve / reject ===
  bot.hears(/\/approve_(\d+)/, async (ctx) => {
    if (!adminIds.includes(ctx.from?.id || 0)) return;
    const paymentId = parseInt(ctx.match[1], 10);
    const result = await confirmAndFulfillPayment(paymentId, true);
    if (!result.ok) return ctx.reply('Payment not found or already processed.');
    return ctx.reply(`✅ Payment #${paymentId} approved.`);
  });

  bot.hears(/\/reject_(\d+)/, async (ctx) => {
    if (!adminIds.includes(ctx.from?.id || 0)) return;
    const paymentId = parseInt(ctx.match[1], 10);
    const result = await rejectPaymentAndNotify(paymentId);
    if (!result.ok) return ctx.reply('Payment not found or already processed.');
    return ctx.reply(`❌ Payment #${paymentId} rejected.`);
  });

  bot.catch((err) => {
    console.error('[BOT] Unhandled error:', err);
  });

  return bot;
}

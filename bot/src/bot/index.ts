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
import { getActiveOrders, purchaseWithWallet, getOrderById, createOrder } from '../services/order.service.js';
import { formatPrice, formatVolume, formatDuration } from '../i18n/index.js';
import { db } from '../db/index.js';
import { payments, trials, discountCodes, users, walletTransactions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { zarinpalRequest } from '../payments/index.js';

interface SessionData {
  step?: string;
  selectedProduct?: number;
  selectedCategory?: number;
  pendingPayment?: number;
  discountCode?: string;
}

type BotContext = Context & SessionFlavor<SessionData>;

export function createBot() {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  bot.use(session({ initial: (): SessionData => ({}) }));

  // === Channel membership check helper ===
  async function checkChannelMembership(ctx: BotContext, telegramId: number): Promise<boolean> {
    if (!config.CHANNEL_ENABLED || !config.CHANNEL_ID) return true;
    try {
      const member = await ctx.api.getChatMember(config.CHANNEL_ID, telegramId);
      return ['member', 'administrator', 'creator'].includes(member.status);
    } catch {
      return true; // If we can't check, don't block
    }
  }

  // === /start command ===
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

    // New user: show language selection
    if (isNew) {
      return ctx.reply(t('fa', 'welcome'), { reply_markup: languageKeyboard() });
    }

    await ctx.reply(t(lang, 'welcomeBack', { name: ctx.from!.first_name || 'User' }), {
      reply_markup: mainMenuKeyboard(lang),
    });
  });

  // === /help command ===
  bot.command('help', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    const lang = (user?.language || 'fa') as Language;
    await ctx.reply(t(lang, 'support_menu'), { reply_markup: supportKeyboard(lang) });
  });

  // === Text message handlers ===
  bot.on('message:text', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    if (!user) return;
    if (user.isBlocked) return ctx.reply(t(user.language as Language, 'error_blocked'));

    const lang = user.language as Language;
    const text = ctx.message.text;

    // === Handle multi-step flows first ===
    if (ctx.session.step === 'awaiting_charge_amount') {
      ctx.session.step = undefined;
      const amount = parseInt(text.replace(/[,،\s]/g, ''));
      if (isNaN(amount) || amount < 1000) {
        return ctx.reply(t(lang, 'error_generic'), { reply_markup: mainMenuKeyboard(lang) });
      }
      // Create pending payment for wallet charge
      const [payment] = await db.insert(payments).values({
        userId: user.id,
        gateway: 'card',
        amount,
        status: 'pending',
        description: `Wallet charge: ${amount}`,
      }).returning();

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
      // Forward message to admins
      for (const adminId of adminIds) {
        try {
          await ctx.api.sendMessage(adminId,
            `📩 Support message from ${ctx.from.first_name} (@${ctx.from.username || user.telegramId}):\n\n${text}`,
          );
        } catch { /* admin may not have started the bot */ }
      }
      return ctx.reply(t(lang, 'support_sent'), { reply_markup: mainMenuKeyboard(lang) });
    }

    if (ctx.session.step === 'awaiting_discount') {
      ctx.session.step = undefined;
      if (text === '➖' || text.toLowerCase() === 'skip') {
        ctx.session.discountCode = undefined;
      } else {
        const code = await db.query.discountCodes.findFirst({
          where: eq(discountCodes.code, text.trim()),
        });
        if (!code || !code.isActive || (code.expireAt && code.expireAt < new Date()) || (code.maxUses && code.usedCount >= code.maxUses)) {
          return ctx.reply(t(lang, 'discount_invalid'), { reply_markup: mainMenuKeyboard(lang) });
        }
        ctx.session.discountCode = text.trim();
      }
      // Proceed to payment
      return ctx.reply(t(lang, 'payment_select_method'), {
        reply_markup: paymentMethodKeyboard(lang, user.balance),
      });
    }

    // === Main menu actions ===
    if (text === t(lang, 'menu_shop')) {
      // Channel check
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
        const name = product ? (lang === 'fa' ? product.name : (product.nameEn || product.name)) : `#${order.id}`;
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

  // === Callback query handlers ===
  bot.on('callback_query:data', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    if (!user) return ctx.answerCallbackQuery();
    const lang = user.language as Language;
    const data = ctx.callbackQuery.data;

    await ctx.answerCallbackQuery();

    // Language selection
    if (data.startsWith('lang:')) {
      const newLang = data.split(':')[1] as Language;
      await updateUserLanguage(user.id, newLang);
      return ctx.reply(t(newLang, 'welcomeBack', { name: ctx.from.first_name || 'User' }), {
        reply_markup: mainMenuKeyboard(newLang),
      });
    }

    // Channel check
    if (data === 'check:channel') {
      if (await checkChannelMembership(ctx, ctx.from.id)) {
        const cats = await getActiveCategories();
        return ctx.reply(t(lang, 'shop_select_category'), { reply_markup: categoryKeyboard(cats, lang) });
      }
      return ctx.answerCallbackQuery({ text: t(lang, 'channel_not_joined'), show_alert: true });
    }

    // Category selection
    if (data.startsWith('cat:')) {
      const catId = parseInt(data.split(':')[1]);
      ctx.session.selectedCategory = catId;
      const prods = await getProductsByCategory(catId);
      if (prods.length === 0) return ctx.reply(t(lang, 'shop_no_products'));
      return ctx.reply(t(lang, 'shop_select_product'), {
        reply_markup: productKeyboard(prods, lang),
      });
    }

    // Product selection
    if (data.startsWith('prod:')) {
      const prodId = parseInt(data.split(':')[1]);
      ctx.session.selectedProduct = prodId;
      const product = await getProductById(prodId);
      if (!product) return ctx.reply(t(lang, 'error_not_found'));

      const name = lang === 'fa' ? product.name : (product.nameEn || product.name);
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

    // Purchase confirm → ask for discount code
    if (data === 'buy:confirm') {
      const prodId = ctx.session.selectedProduct;
      if (!prodId) return ctx.reply(t(lang, 'error_generic'));
      ctx.session.step = 'awaiting_discount';
      return ctx.reply(t(lang, 'discount_enter'));
    }

    // Purchase cancel
    if (data === 'buy:cancel') {
      ctx.session.selectedProduct = undefined;
      ctx.session.discountCode = undefined;
      return ctx.reply(t(lang, 'back_to_menu'), { reply_markup: mainMenuKeyboard(lang) });
    }

    // Pay with wallet
    if (data === 'pay:wallet') {
      const prodId = ctx.session.selectedProduct;
      if (!prodId) return ctx.reply(t(lang, 'error_generic'));

      const product = await getProductById(prodId);
      if (!product) return ctx.reply(t(lang, 'error_not_found'));

      // Apply discount
      let finalPrice = product.price;
      if (ctx.session.discountCode) {
        const code = await db.query.discountCodes.findFirst({
          where: eq(discountCodes.code, ctx.session.discountCode),
        });
        if (code && code.isActive) {
          finalPrice = Math.round(finalPrice * (1 - Math.min(code.percent, 100) / 100));
          // Increment usage
          await db.update(discountCodes).set({ usedCount: sql`${discountCodes.usedCount} + 1` }).where(eq(discountCodes.id, code.id));
        }
      }

      if (user.balance < finalPrice) {
        return ctx.reply(
          t(lang, 'payment_insufficient', {
            balance: user.balance.toLocaleString(),
            required: finalPrice.toLocaleString(),
          }),
        );
      }

      try {
        const result = await purchaseWithWallet(user.id, prodId, finalPrice);
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

    // Pay with card
    if (data === 'pay:card') {
      const prodId = ctx.session.selectedProduct;
      if (!prodId) return ctx.reply(t(lang, 'error_generic'));
      const product = await getProductById(prodId);
      if (!product) return ctx.reply(t(lang, 'error_not_found'));

      let finalPrice = product.price;
      if (ctx.session.discountCode) {
        const code = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, ctx.session.discountCode) });
        if (code && code.isActive) finalPrice = Math.round(finalPrice * (1 - Math.min(code.percent, 100) / 100));
      }

      // Create pending payment record
      const [payment] = await db.insert(payments).values({
        userId: user.id,
        orderId: undefined,
        gateway: 'card',
        amount: finalPrice,
        status: 'pending',
        description: `Product #${prodId}`,
      }).returning();

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

    // Pay with Zarinpal
    if (data === 'pay:zarinpal') {
      const prodId = ctx.session.selectedProduct;
      if (!prodId) return ctx.reply(t(lang, 'error_generic'));
      const product = await getProductById(prodId);
      if (!product) return ctx.reply(t(lang, 'error_not_found'));

      let finalPrice = product.price;
      if (ctx.session.discountCode) {
        const code = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, ctx.session.discountCode) });
        if (code && code.isActive) finalPrice = Math.round(finalPrice * (1 - Math.min(code.percent, 100) / 100));
      }

      if (!config.ZARINPAL_MERCHANT_ID) return ctx.reply(t(lang, 'error_generic'));

      try {
        const result = await zarinpalRequest({ amount: finalPrice, userId: user.id, description: `Product #${prodId}` });
        if (!result.success || !result.paymentUrl) return ctx.reply(t(lang, 'error_generic'));

        const [payment] = await db.insert(payments).values({
          userId: user.id,
          gateway: 'zarinpal',
          amount: finalPrice,
          status: 'pending',
          refId: result.authority,
          description: `Product #${prodId}`,
        }).returning();

        ctx.session.pendingPayment = payment.id;
        return ctx.reply(t(lang, 'payment_online_link'), {
          reply_markup: { inline_keyboard: [[{ text: t(lang, 'payment_pay_button'), url: result.paymentUrl }]] },
        });
      } catch {
        return ctx.reply(t(lang, 'error_generic'));
      }
    }

    // Pay with crypto (NowPayments)
    if (data === 'pay:nowpayments') {
      const prodId = ctx.session.selectedProduct;
      if (!prodId) return ctx.reply(t(lang, 'error_generic'));
      const product = await getProductById(prodId);
      if (!product) return ctx.reply(t(lang, 'error_not_found'));

      if (!config.NOWPAYMENTS_API_KEY) return ctx.reply(t(lang, 'error_generic'));

      try {
        const { nowpaymentsRequest } = await import('../payments/index.js');
        const result = await nowpaymentsRequest({ amount: product.price, userId: user.id, description: `Product #${prodId}` });
        if (!result.success || !result.paymentUrl) return ctx.reply(t(lang, 'error_generic'));

        await db.insert(payments).values({
          userId: user.id,
          gateway: 'nowpayments',
          amount: product.price,
          status: 'pending',
          refId: result.refId,
          description: `Product #${prodId}`,
        });

        return ctx.reply(t(lang, 'payment_online_link'), {
          reply_markup: { inline_keyboard: [[{ text: t(lang, 'payment_pay_button'), url: result.paymentUrl }]] },
        });
      } catch {
        return ctx.reply(t(lang, 'error_generic'));
      }
    }

    // Service actions
    if (data.startsWith('svc:')) {
      const [, action, idStr] = data.split(':');
      const orderId = parseInt(idStr);
      const order = await getOrderById(orderId);
      if (!order || order.userId !== user.id) return ctx.reply(t(lang, 'error_not_found'));

      if (action === 'config' || action === 'sub') {
        return ctx.reply(`🔗 ${order.subLink || 'N/A'}`);
      }
      if (action === 'renew') {
        const product = await getProductById(order.productId);
        if (!product) return ctx.reply(t(lang, 'error_not_found'));
        // Renew = purchase same product again with wallet
        if (user.balance < product.price) {
          return ctx.reply(t(lang, 'payment_insufficient', {
            balance: user.balance.toLocaleString(),
            required: product.price.toLocaleString(),
          }));
        }
        try {
          const { renewOrder } = await import('../services/order.service.js');
          await db.update(users).set({ balance: sql`${users.balance} - ${product.price}`, updatedAt: new Date() }).where(eq(users.id, user.id));
          await db.insert(walletTransactions).values({ userId: user.id, amount: -product.price, type: 'purchase', description: `Renew order #${orderId}` });
          await renewOrder(orderId, product.durationDays);
          return ctx.reply(t(lang, 'service_renewed'), { reply_markup: mainMenuKeyboard(lang) });
        } catch {
          return ctx.reply(t(lang, 'error_generic'));
        }
      }
      if (action === 'volume') {
        return ctx.reply(t(lang, 'service_volume') + ' - ' + t(lang, 'support_contact'), {
          reply_markup: backToMenuKeyboard(lang),
        });
      }
    }

    // Wallet actions
    if (data === 'wallet:charge') {
      ctx.session.step = 'awaiting_charge_amount';
      return ctx.reply(t(lang, 'wallet_charge_amount'));
    }
    if (data === 'wallet:history') {
      const txs = await db.query.walletTransactions.findMany({
        where: eq(walletTransactions.userId, user.id),
        limit: 10,
      });
      if (txs.length === 0) return ctx.reply(t(lang, 'wallet_empty_history'), { reply_markup: backToMenuKeyboard(lang) });
      let msg = '';
      for (const tx of txs) {
        const sign = tx.amount > 0 ? '+' : '';
        msg += `${sign}${tx.amount.toLocaleString()} | ${tx.type} | ${tx.createdAt.toLocaleDateString()}\n`;
      }
      return ctx.reply(msg, { reply_markup: backToMenuKeyboard(lang) });
    }

    // Account actions
    if (data === 'account:referral') {
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
      return ctx.reply(t(lang, 'account_language'), { reply_markup: languageKeyboard() });
    }

    // Support
    if (data === 'support:faq') {
      return ctx.reply(t(lang, 'support_faq', { faq: '1. How to connect?\n2. How to renew?' }), {
        reply_markup: backToMenuKeyboard(lang),
      });
    }
    if (data === 'support:contact') {
      ctx.session.step = 'awaiting_support_msg';
      return ctx.reply(t(lang, 'support_contact'));
    }

    // Trial
    if (data === 'trial:confirm') {
      if (!config.TRIAL_ENABLED) return ctx.reply(t(lang, 'trial_disabled'));

      // Check if already used
      const existingTrial = await db.query.trials.findFirst({ where: eq(trials.userId, user.id) });
      if (existingTrial) return ctx.reply(t(lang, 'trial_used'));

      try {
        const result = await createOrder({
          userId: user.id,
          productId: 1,
          isTrial: true,
          finalPrice: 0,
        });

        await db.insert(trials).values({
          userId: user.id,
          orderId: result.order.id,
          expireAt: new Date(Date.now() + config.TRIAL_DAYS * 24 * 60 * 60 * 1000),
        });

        return ctx.reply(t(lang, 'trial_created', {
          days: config.TRIAL_DAYS,
          volume: config.TRIAL_VOLUME_GB,
          config: result.subLink,
        }), { reply_markup: mainMenuKeyboard(lang) });
      } catch {
        return ctx.reply(t(lang, 'error_generic'));
      }
    }

    // Back to menu
    if (data === 'menu:main') {
      ctx.session.step = undefined;
      return ctx.reply(t(lang, 'welcomeBack', { name: ctx.from.first_name || 'User' }), {
        reply_markup: mainMenuKeyboard(lang),
      });
    }

    // Shop back
    if (data === 'shop:back') {
      const cats = await getActiveCategories();
      return ctx.reply(t(lang, 'shop_select_category'), {
        reply_markup: categoryKeyboard(cats, lang),
      });
    }
  });

  // === Photo handler (receipt upload) ===
  bot.on('message:photo', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    if (!user) return;
    const lang = user.language as Language;

    if (ctx.session.step === 'awaiting_receipt') {
      const paymentId = ctx.session.pendingPayment;
      ctx.session.step = undefined;
      ctx.session.pendingPayment = undefined;

      if (paymentId) {
        // Save receipt file_id to payment
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await db.update(payments).set({ receiptPhoto: photo.file_id }).where(eq(payments.id, paymentId));

        // Forward to admins for approval
        for (const adminId of adminIds) {
          try {
            await ctx.api.sendPhoto(adminId, photo.file_id, {
              caption: `💳 Receipt from ${ctx.from.first_name} (@${ctx.from.username || user.telegramId})\nPayment #${paymentId}\nUse /approve_${paymentId} or /reject_${paymentId}`,
            });
          } catch { /* admin may not have started the bot */ }
        }
      }

      return ctx.reply(t(lang, 'payment_receipt_sent'), {
        reply_markup: mainMenuKeyboard(lang),
      });
    }
  });

  // === Admin approval commands ===
  bot.hears(/\/approve_(\d+)/, async (ctx) => {
    if (!adminIds.includes(ctx.from?.id || 0)) return;
    const paymentId = parseInt(ctx.match[1]);
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!payment || payment.status !== 'pending') return ctx.reply('Payment not found or already processed.');

    await db.update(payments).set({ status: 'confirmed' }).where(eq(payments.id, paymentId));

    // Credit wallet
    await db.update(users).set({ balance: sql`${users.balance} + ${payment.amount}`, updatedAt: new Date() }).where(eq(users.id, payment.userId));
    await db.insert(walletTransactions).values({
      userId: payment.userId,
      amount: payment.amount,
      type: 'charge',
      description: `Card payment #${paymentId} approved`,
    });

    // Notify user
    try {
      const payUser = await db.query.users.findFirst({ where: eq(users.id, payment.userId) });
      if (payUser) await ctx.api.sendMessage(payUser.telegramId, t('fa', 'payment_approved'));
    } catch { /* user may not have started bot */ }

    return ctx.reply(`✅ Payment #${paymentId} approved.`);
  });

  bot.hears(/\/reject_(\d+)/, async (ctx) => {
    if (!adminIds.includes(ctx.from?.id || 0)) return;
    const paymentId = parseInt(ctx.match[1]);
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!payment || payment.status !== 'pending') return ctx.reply('Payment not found or already processed.');

    await db.update(payments).set({ status: 'rejected' }).where(eq(payments.id, paymentId));

    try {
      const payUser = await db.query.users.findFirst({ where: eq(users.id, payment.userId) });
      if (payUser) await ctx.api.sendMessage(payUser.telegramId, t('fa', 'payment_rejected'));
    } catch { /* */ }

    return ctx.reply(`❌ Payment #${paymentId} rejected.`);
  });

  return bot;
}

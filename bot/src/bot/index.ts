import { Bot, Context, session, SessionFlavor } from 'grammy';
import { config } from '../config.js';
import { t, type Language } from '../i18n/index.js';
import { getOrCreateUser, getUserByTelegramId, isUserBlocked } from '../services/user.service.js';
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
} from './keyboards.js';
import { getActiveCategories, getProductsByCategory, getProductById } from '../services/product.service.js';
import { getActiveOrders, purchaseWithWallet, getOrderById } from '../services/order.service.js';
import { getReferralStats } from '../services/user.service.js';
import { formatPrice, formatVolume, formatDuration } from '../i18n/index.js';

interface SessionData {
  step?: string;
  selectedProduct?: number;
  selectedCategory?: number;
  pendingPayment?: number;
}

type BotContext = Context & SessionFlavor<SessionData>;

export function createBot() {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  bot.use(session({ initial: (): SessionData => ({}) }));

  // === /start command ===
  bot.command('start', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Extract referral code from payload
    const payload = ctx.match?.trim();
    const refCode = payload && payload.length > 0 ? payload : undefined;

    const user = await getOrCreateUser(
      {
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      },
      refCode,
    );

    if (user.isBlocked) {
      return ctx.reply(t(user.language as Language, 'error_blocked'));
    }

    const lang = user.language as Language;

    // If new user (no language set yet or first time), show language selection
    if (!payload && !user.username && !user.firstName) {
      return ctx.reply(t('fa', 'welcome'), { reply_markup: languageKeyboard() });
    }

    await ctx.reply(t(lang, 'welcomeBack', { name: ctx.from.first_name || 'User' }), {
      reply_markup: mainMenuKeyboard(lang),
    });
  });

  // === /help command ===
  bot.command('help', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    const lang = (user?.language || 'fa') as Language;
    await ctx.reply(t(lang, 'support_menu'), { reply_markup: supportKeyboard(lang) });
  });

  // === Text message handlers (main menu) ===
  bot.on('message:text', async (ctx) => {
    const user = await getUserByTelegramId(ctx.from?.id || 0);
    if (!user) return;
    if (user.isBlocked) return ctx.reply(t(user.language as Language, 'error_blocked'));

    const lang = user.language as Language;
    const text = ctx.message.text;

    // Main menu actions
    if (text === t(lang, 'menu_shop')) {
      const cats = await getActiveCategories();
      if (cats.length === 0) return ctx.reply(t(lang, 'shop_no_products'));
      return ctx.reply(t(lang, 'shop_select_category'), {
        reply_markup: categoryKeyboard(cats, lang),
      });
    }

    if (text === t(lang, 'menu_services')) {
      const orders = await getActiveOrders(user.id);
      if (orders.length === 0) return ctx.reply(t(lang, 'services_empty'));

      let msg = t(lang, 'services_list');
      for (const order of orders.slice(0, 10)) {
        const product = await getProductById(order.productId);
        const name = product ? (lang === 'fa' ? product.name : (product.nameEn || product.name)) : `#${order.id}`;
        msg += `• ${name} | ${order.status === 'active' ? '✅' : '⏳'}\n`;
      }
      return ctx.reply(msg, { reply_markup: backToMenuKeyboard(lang) });
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
      const { updateUserLanguage } = await import('../services/user.service.js');
      await updateUserLanguage(user.id, newLang);
      return ctx.editMessageText(t(newLang, 'welcomeBack', { name: ctx.from.first_name || 'User' }), {
        reply_markup: mainMenuKeyboard(newLang) as any,
      });
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

    // Purchase confirm
    if (data === 'buy:confirm') {
      const prodId = ctx.session.selectedProduct;
      if (!prodId) return ctx.reply(t(lang, 'error_generic'));
      return ctx.reply(t(lang, 'payment_select_method'), {
        reply_markup: paymentMethodKeyboard(lang, user.balance),
      });
    }

    // Purchase cancel
    if (data === 'buy:cancel') {
      ctx.session.selectedProduct = undefined;
      return ctx.reply(t(lang, 'back_to_menu'), { reply_markup: mainMenuKeyboard(lang) });
    }

    // Pay with wallet
    if (data === 'pay:wallet') {
      const prodId = ctx.session.selectedProduct;
      if (!prodId) return ctx.reply(t(lang, 'error_generic'));

      const product = await getProductById(prodId);
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
        const result = await purchaseWithWallet(user.id, prodId, product.price, lang);
        ctx.session.selectedProduct = undefined;

        const name = lang === 'fa' ? product.name : (product.nameEn || product.name);
        return ctx.reply(
          t(lang, 'config_created', {
            username: result.email,
            volume: formatVolume(product.volumeGb, lang),
            expiry: result.order.expireAt?.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US') || '-',
            config: result.subLink,
            sub: result.subLink,
          }),
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

      ctx.session.step = 'awaiting_receipt';
      ctx.session.pendingPayment = prodId;

      return ctx.reply(
        t(lang, 'payment_card_info', {
          amount: product.price.toLocaleString(),
          card: config.CARD_NUMBER,
          holder: config.CARD_HOLDER,
        }),
      );
    }

    // Pay with zarinpal
    if (data === 'pay:zarinpal') {
      return ctx.reply(t(lang, 'payment_online_link'), {
        reply_markup: backToMenuKeyboard(lang),
      });
    }

    // Pay with nowpayments
    if (data === 'pay:nowpayments') {
      return ctx.reply(t(lang, 'payment_online_link'), {
        reply_markup: backToMenuKeyboard(lang),
      });
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
        return ctx.reply(t(lang, 'service_renew') + ' - Coming soon', {
          reply_markup: backToMenuKeyboard(lang),
        });
      }
      if (action === 'volume') {
        return ctx.reply(t(lang, 'service_volume') + ' - Coming soon', {
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
      return ctx.reply(t(lang, 'wallet_empty_history'), { reply_markup: backToMenuKeyboard(lang) });
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
      // TODO: Create trial config
      return ctx.reply(t(lang, 'trial_created', {
        days: config.TRIAL_DAYS,
        volume: config.TRIAL_VOLUME_GB,
        config: 'trial-config-link',
      }));
    }

    // Back to menu
    if (data === 'menu:main') {
      ctx.session.step = undefined;
      return ctx.editMessageText(t(lang, 'welcomeBack', { name: ctx.from.first_name || 'User' }), {
        reply_markup: mainMenuKeyboard(lang) as any,
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
      ctx.session.step = undefined;
      ctx.session.pendingPayment = undefined;
      // TODO: Forward receipt to admin for approval
      return ctx.reply(t(lang, 'payment_receipt_sent'), {
        reply_markup: mainMenuKeyboard(lang),
      });
    }
  });

  return bot;
}

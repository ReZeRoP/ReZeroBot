import { InlineKeyboard, Keyboard } from 'grammy';
import { t, type Language } from '../i18n/index.js';
import { config } from '../config.js';

export function mainMenuKeyboard(lang: Language): Keyboard {
  return new Keyboard()
    .text(t(lang, 'menu_shop'))
    .text(t(lang, 'menu_services'))
    .row()
    .text(t(lang, 'menu_wallet'))
    .text(t(lang, 'menu_account'))
    .row()
    .text(t(lang, 'menu_support'))
    .text(t(lang, 'menu_trial'))
    .resized()
    .persistent();
}

export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🇮🇷 فارسی', 'lang:fa')
    .text('🇬🇧 English', 'lang:en');
}

export function categoryKeyboard(
  categories: Array<{ id: number; name: string; nameEn?: string | null }>,
  lang: Language,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const cat of categories) {
    const label = lang === 'fa' ? cat.name : (cat.nameEn || cat.name);
    kb.text(label, `cat:${cat.id}`).row();
  }
  return kb;
}

export function productKeyboard(
  products: Array<{ id: number; name: string; nameEn?: string | null; price: number }>,
  lang: Language,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of products) {
    const label = lang === 'fa' ? p.name : (p.nameEn || p.name);
    kb.text(`${label} - ${p.price.toLocaleString()}`, `prod:${p.id}`).row();
  }
  kb.text(t(lang, 'shop_back'), 'shop:back');
  return kb;
}

export function confirmPurchaseKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'shop_confirm_buy'), 'buy:confirm')
    .text(t(lang, 'shop_cancel'), 'buy:cancel');
}

export function paymentMethodKeyboard(lang: Language, balance: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(t(lang, 'payment_wallet', { balance: balance.toLocaleString() }), 'pay:wallet').row();
  kb.text(t(lang, 'payment_card'), 'pay:card').row();
  kb.text(t(lang, 'payment_zarinpal'), 'pay:zarinpal').row();
  kb.text(t(lang, 'payment_nowpayments'), 'pay:nowpayments').row();
  kb.text(t(lang, 'shop_cancel'), 'buy:cancel');
  return kb;
}

export function serviceActionsKeyboard(orderId: number, lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'service_config'), `svc:config:${orderId}`)
    .text(t(lang, 'service_sub'), `svc:sub:${orderId}`)
    .row()
    .text(t(lang, 'service_renew'), `svc:renew:${orderId}`)
    .text(t(lang, 'service_volume'), `svc:volume:${orderId}`)
    .row()
    .text(t(lang, 'back_to_menu'), 'menu:main');
}

export function walletKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'wallet_charge'), 'wallet:charge')
    .text(t(lang, 'wallet_history'), 'wallet:history')
    .row()
    .text(t(lang, 'back_to_menu'), 'menu:main');
}

export function accountKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'account_referral'), 'account:referral')
    .text(t(lang, 'account_language'), 'account:language')
    .row()
    .text(t(lang, 'back_to_menu'), 'menu:main');
}

export function supportKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text('📖 FAQ', 'support:faq')
    .text('💬 Contact', 'support:contact')
    .row()
    .text(t(lang, 'back_to_menu'), 'menu:main');
}

export function channelCheckKeyboard(lang: Language): InlineKeyboard {
  const channelUrl = config.CHANNEL_ID.startsWith('@')
    ? `https://t.me/${config.CHANNEL_ID.slice(1)}`
    : config.CHANNEL_ID;
  return new InlineKeyboard()
    .url(t(lang, 'channel_join'), channelUrl)
    .row()
    .text(t(lang, 'channel_check'), 'check:channel');
}

export function trialKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'trial_confirm'), 'trial:confirm')
    .text(t(lang, 'shop_cancel'), 'menu:main');
}

export function backToMenuKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard().text(t(lang, 'back_to_menu'), 'menu:main');
}

export const fa = {
  // Welcome & Start
  welcome: '👋 خوش آمدید به ربات VPN!\n\nبرای شروع، زبان خود را انتخاب کنید:',
  welcomeBack: '👋 خوش آمدید {name}!\n\nاز منوی زیر گزینه مورد نظر را انتخاب کنید:',
  languageSet: '✅ زبان فارسی انتخاب شد.',

  // Main Menu
  menu_shop: '🛒 فروشگاه',
  menu_services: '📦 سرویس‌های من',
  menu_wallet: '💰 کیف پول',
  menu_account: '👤 حساب کاربری',
  menu_support: '🎧 پشتیبانی',
  menu_trial: '🎁 تست رایگان',

  // Shop
  shop_select_category: '📂 دسته‌بندی مورد نظر را انتخاب کنید:',
  shop_select_product: '🛍️ محصول مورد نظر را انتخاب کنید:',
  shop_product_info: '📋 اطلاعات محصول:\n\n🏷️ نام: {name}\n💰 قیمت: {price}\n📊 حجم: {volume}\n⏱️ مدت: {duration}\n\nآیا مایل به خرید هستید؟',
  shop_confirm_buy: '✅ بله، خرید می‌کنم',
  shop_cancel: '❌ انصراف',
  shop_no_products: '😕 متأسفانه محصولی در این دسته‌بندی موجود نیست.',
  shop_back: '🔙 بازگشت',

  // Payment
  payment_select_method: '💳 روش پرداخت را انتخاب کنید:',
  payment_wallet: '💰 کیف پول (موجودی: {balance})',
  payment_card: '💳 کارت به کارت',
  payment_zarinpal: '🌐 زرین‌پال',
  payment_nowpayments: '🪙 NowPayments (کریپتو)',
  payment_insufficient: '❌ موجودی کیف پول کافی نیست.\nموجودی: {balance}\nمورد نیاز: {required}',
  payment_card_info: '💳 لطفاً مبلغ {amount} تومان را به کارت زیر واریز کنید:\n\n💳 شماره کارت: {card}\n👤 به نام: {holder}\n\n📸 پس از واریز، تصویر رسید را ارسال کنید.',
  payment_receipt_sent: '✅ رسید شما دریافت شد و در انتظار تأیید مدیر است.',
  payment_approved: '✅ پرداخت شما تأیید شد!',
  payment_rejected: '❌ پرداخت شما رد شد. لطفاً با پشتیبانی تماس بگیرید.',
  payment_online_link: '🌐 برای پرداخت روی دکمه زیر کلیک کنید:',
  payment_pay_button: '💳 پرداخت آنلاین',
  payment_success: '✅ پرداخت با موفقیت انجام شد!',
  payment_failed: '❌ پرداخت ناموفق بود. لطفاً دوباره تلاش کنید.',

  // Config Delivery
  config_created: '✅ سرویس شما با موفقیت ایجاد شد!\n\n👤 نام کاربری: {username}\n📊 حجم: {volume}\n⏱️ انقضا: {expiry}\n\n🔗 لینک کانفیگ:\n{config}\n\n📡 لینک سابسکریپشن:\n{sub}',
  config_qr: '📱 کد QR کانفیگ:',
  config_copy: '📋 کپی کانفیگ',

  // Services
  services_list: '📦 سرویس‌های فعال شما:\n\n',
  services_empty: '😕 شما هیچ سرویس فعالی ندارید.\nاز فروشگاه خرید کنید!',
  service_info: '📋 اطلاعات سرویس:\n\n🏷️ نام: {name}\n📊 حجم مصرفی: {used} / {total}\n⏱️ انقضا: {expiry}\n📈 وضعیت: {status}',
  service_renew: '🔄 تمدید',
  service_volume: '📊 خرید حجم',
  service_config: '🔗 دریافت کانفیگ',
  service_sub: '📡 لینک سابسکریپشن',
  service_status_active: '✅ فعال',
  service_status_expired: '❌ منقضی',
  service_status_pending: '⏳ در انتظار',
  service_renewed: '✅ سرویس شما با موفقیت تمدید شد!',
  service_expired: '⚠️ سرویس {service} شما منقضی شد. برای تمدید به فروشگاه مراجعه کنید.',
  expiry_reminder: '⏰ سرویس {service} شما تا {days} روز دیگر منقضی می‌شود. برای تمدید اقدام کنید.',

  // Wallet
  wallet_balance: '💰 موجودی کیف پول شما: {balance} تومان',
  wallet_charge: '💵 شارژ کیف پول',
  wallet_history: '📜 تاریخچه تراکنش‌ها',
  wallet_charge_amount: '💵 مبلغ شارژ را به تومان وارد کنید:',
  wallet_charged: '✅ کیف پول شما با موفقیت شارژ شد!\nمبلغ: {amount} تومان\nموجودی جدید: {balance} تومان',
  wallet_empty_history: '📭 تراکنشی یافت نشد.',

  // Account
  account_info: '👤 اطلاعات حساب:\n\n🆔 آیدی: {id}\n👤 نام: {name}\n💰 موجودی: {balance}\n📅 عضویت: {date}\n🔗 کد معرفی: {ref}',
  account_referral: '🔗 لینک معرفی شما:\n{link}\n\n👥 تعداد معرفی‌ها: {count}\n💰 درآمد معرفی: {earnings}',
  account_language: '🌐 تغییر زبان',

  // Trial
  trial_available: '🎁 تست رایگان!\n\nشما می‌توانید یک اکانت تست {days} روزه با {volume} گیگ حجم دریافت کنید.\n\nآیا مایلید؟',
  trial_confirm: '✅ بله، تست می‌خواهم',
  trial_used: '❌ شما قبلاً از تست رایگان استفاده کرده‌اید.',
  trial_created: '✅ اکانت تست شما ایجاد شد!\n\n⏱️ مدت: {days} روز\n📊 حجم: {volume} گیگ\n\n{config}',
  trial_disabled: '❌ تست رایگان در حال حاضر غیرفعال است.',

  // Referral
  referral_joined: '🎉 شما توسط یک دوست معرفی شدید! {reward} تومان هدیه دریافت کردید.',
  referral_reward: '🎉 یکی از معرفی‌های شما خرید کرد! {reward} تومان به کیف پول شما اضافه شد.',

  // Discount
  discount_enter: '🏷️ کد تخفیف خود را وارد کنید (یا /skip برای رد کردن):',
  discount_applied: '✅ کد تخفیف اعمال شد! {percent}% تخفیف',
  discount_invalid: '❌ کد تخفیف نامعتبر است.',
  discount_skipped: '⏭️ بدون کد تخفیف ادامه می‌دهیم.',

  // Gift
  gift_enter: '🎁 کد هدیه خود را وارد کنید:',
  gift_redeemed: '✅ کد هدیه اعمال شد! {amount} تومان به کیف پول شما اضافه شد.',
  gift_invalid: '❌ کد هدیه نامعتبر یا استفاده شده است.',

  // Support
  support_menu: '🎧 پشتیبانی\n\n📖 سوالات متداول\n📚 آموزش‌ها\n💬 تماس با ادمین',
  support_faq: '📖 سوالات متداول:\n\n{faq}',
  support_contact: '💬 برای تماس با ادمین، پیام خود را ارسال کنید.',
  support_sent: '✅ پیام شما به ادمین ارسال شد.',

  // Channel
  channel_required: '⚠️ برای استفاده از ربات، ابتدا در کانال ما عضو شوید:',
  channel_join: '📢 عضویت در کانال',
  channel_check: '✅ بررسی عضویت',
  channel_joined: '✅ ممنون! عضویت شما تأیید شد.',
  channel_not_joined: '❌ شما هنوز عضو کانال نشده‌اید.',

  // Phone
  phone_request: '📱 لطفاً شماره تلفن خود را ارسال کنید:',
  phone_share: '📱 ارسال شماره تلفن',
  phone_verified: '✅ شماره تلفن شما تأیید شد.',

  // Admin
  admin_only: '⛔ این بخش فقط برای مدیران است.',
  admin_panel: '🛠️ پنل مدیریت',

  // Errors
  error_generic: '❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.',
  error_blocked: '⛔ حساب شما مسدود شده است. با پشتیبانی تماس بگیرید.',
  error_not_found: '❌ موردی یافت نشد.',

  // Misc
  loading: '⏳ لطفاً صبر کنید...',
  back_to_menu: '🏠 منوی اصلی',
  cancel: '❌ لغو',
  confirm: '✅ تأیید',
  tomans: 'تومان',
  unlimited: 'نامحدود',
  days: 'روز',
  gb: 'گیگابایت',
} as const;

export type TranslationKey = keyof typeof fa;

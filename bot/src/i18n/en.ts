import type { TranslationKey } from './fa.js';

export const en: Record<TranslationKey, string> = {
  // Welcome & Start
  welcome: '👋 Welcome to VPN Bot!\n\nPlease select your language:',
  welcomeBack: '👋 Welcome back, {name}!\n\nChoose an option from the menu below:',
  languageSet: '✅ English language selected.',

  // Main Menu
  menu_shop: '🛒 Shop',
  menu_services: '📦 My Services',
  menu_wallet: '💰 Wallet',
  menu_account: '👤 Account',
  menu_support: '🎧 Support',
  menu_trial: '🎁 Free Trial',

  // Shop
  shop_select_category: '📂 Select a category:',
  shop_select_product: '🛍️ Select a product:',
  shop_product_info: '📋 Product Info:\n\n🏷️ Name: {name}\n💰 Price: {price}\n📊 Volume: {volume}\n⏱️ Duration: {duration}\n\nWould you like to purchase?',
  shop_confirm_buy: '✅ Yes, buy it',
  shop_cancel: '❌ Cancel',
  shop_no_products: '😕 Sorry, no products available in this category.',
  shop_back: '🔙 Back',

  // Payment
  payment_select_method: '💳 Select payment method:',
  payment_wallet: '💰 Wallet (Balance: {balance})',
  payment_card: '💳 Card to Card',
  payment_zarinpal: '🌐 Zarinpal',
  payment_nowpayments: '🪙 NowPayments (Crypto)',
  payment_insufficient: '❌ Insufficient wallet balance.\nBalance: {balance}\nRequired: {required}',
  payment_card_info: '💳 Please transfer {amount} to the following card:\n\n💳 Card: {card}\n👤 Name: {holder}\n\n📸 After payment, send the receipt photo.',
  payment_receipt_sent: '✅ Receipt received. Waiting for admin approval.',
  payment_approved: '✅ Payment approved!',
  payment_rejected: '❌ Payment rejected. Please contact support.',
  payment_online_link: '🌐 Click the button below to pay:',
  payment_pay_button: '💳 Pay Online',
  payment_success: '✅ Payment successful!',
  payment_failed: '❌ Payment failed. Please try again.',

  // Config Delivery
  config_created: '✅ Service created successfully!\n\n👤 Username: {username}\n📊 Volume: {volume}\n⏱️ Expiry: {expiry}\n\n🔗 Config Link:\n{config}\n\n📡 Subscription Link:\n{sub}',
  config_qr: '📱 Config QR Code:',
  config_copy: '📋 Copy Config',

  // Services
  services_list: '📦 Your active services:\n\n',
  services_empty: '😕 You have no active services.\nBuy from the shop!',
  service_info: '📋 Service Info:\n\n🏷️ Name: {name}\n📊 Usage: {used} / {total}\n⏱️ Expiry: {expiry}\n📈 Status: {status}',
  service_renew: '🔄 Renew',
  service_volume: '📊 Buy Volume',
  service_config: '🔗 Get Config',
  service_sub: '📡 Subscription Link',
  service_status_active: '✅ Active',
  service_status_expired: '❌ Expired',
  service_status_pending: '⏳ Pending',
  service_renewed: '✅ Your service has been renewed successfully!',
  service_expired: '⚠️ Your service {service} has expired. Visit the shop to renew.',
  expiry_reminder: '⏰ Your service {service} expires in {days} day(s). Renew now to avoid interruption.',

  // Wallet
  wallet_balance: '💰 Your wallet balance: {balance}',
  wallet_charge: '💵 Charge Wallet',
  wallet_history: '📜 Transaction History',
  wallet_charge_amount: '💵 Enter charge amount:',
  wallet_charged: '✅ Wallet charged successfully!\nAmount: {amount}\nNew balance: {balance}',
  wallet_empty_history: '📭 No transactions found.',

  // Account
  account_info: '👤 Account Info:\n\n🆔 ID: {id}\n👤 Name: {name}\n💰 Balance: {balance}\n📅 Joined: {date}\n🔗 Ref Code: {ref}',
  account_referral: '🔗 Your referral link:\n{link}\n\n👥 Referrals: {count}\n💰 Earnings: {earnings}',
  account_language: '🌐 Change Language',

  // Trial
  trial_available: '🎁 Free Trial!\n\nYou can get a {days}-day trial with {volume} GB volume.\n\nWould you like it?',
  trial_confirm: '✅ Yes, I want a trial',
  trial_used: '❌ You have already used the free trial.',
  trial_created: '✅ Trial account created!\n\n⏱️ Duration: {days} days\n📊 Volume: {volume} GB\n\n{config}',
  trial_disabled: '❌ Free trial is currently disabled.',

  // Referral
  referral_joined: '🎉 You were referred by a friend! You received {reward} bonus.',
  referral_reward: '🎉 One of your referrals made a purchase! {reward} added to your wallet.',

  // Discount
  discount_enter: '🏷️ Enter discount code (or /skip to skip):',
  discount_applied: '✅ Discount applied! {percent}% off',
  discount_invalid: '❌ Invalid discount code.',
  discount_skipped: '⏭️ Continuing without discount.',

  // Gift
  gift_enter: '🎁 Enter your gift code:',
  gift_redeemed: '✅ Gift code redeemed! {amount} added to your wallet.',
  gift_invalid: '❌ Invalid or already used gift code.',

  // Support
  support_menu: '🎧 Support\n\n📖 FAQ\n📚 Tutorials\n💬 Contact Admin',
  support_faq: '📖 FAQ:\n\n{faq}',
  support_contact: '💬 Send your message to contact admin.',
  support_sent: '✅ Your message has been sent to admin.',

  // Channel
  channel_required: '⚠️ Please join our channel first to use the bot:',
  channel_join: '📢 Join Channel',
  channel_check: '✅ Check Membership',
  channel_joined: '✅ Thanks! Membership verified.',
  channel_not_joined: '❌ You have not joined the channel yet.',

  // Phone
  phone_request: '📱 Please share your phone number:',
  phone_share: '📱 Share Phone Number',
  phone_verified: '✅ Phone number verified.',

  // Admin
  admin_only: '⛔ This section is for admins only.',
  admin_panel: '🛠️ Admin Panel',

  // Errors
  error_generic: '❌ An error occurred. Please try again.',
  error_blocked: '⛔ Your account is blocked. Contact support.',
  error_not_found: '❌ Not found.',

  // Misc
  loading: '⏳ Please wait...',
  back_to_menu: '🏠 Main Menu',
  cancel: '❌ Cancel',
  confirm: '✅ Confirm',
  tomans: 'Tomans',
  unlimited: 'Unlimited',
  days: 'days',
  gb: 'GB',
};

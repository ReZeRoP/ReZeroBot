import {
  pgTable,
  serial,
  bigint,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// === Enums ===
export const languageEnum = pgEnum('language', ['fa', 'en']);
export const panelStatusEnum = pgEnum('panel_status', ['active', 'inactive']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'paid', 'active', 'expired', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'confirmed', 'rejected', 'expired']);
export const paymentGatewayEnum = pgEnum('payment_gateway', [
  'card',
  'zarinpal',
  'aqayepardakht',
  'iranpay',
  'nowpayments',
  'plisio',
  'tronado',
  'wallet',
]);
export const walletTxTypeEnum = pgEnum('wallet_tx_type', [
  'charge',
  'purchase',
  'referral',
  'cashback',
  'gift',
  'admin_adjust',
  'lottery',
  'refund',
]);
export const lotteryStatusEnum = pgEnum('lottery_status', ['pending', 'active', 'drawn', 'cancelled']);
export const adminRoleEnum = pgEnum('admin_role', ['owner', 'admin', 'support']);

// === Users ===
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
    username: varchar('username', { length: 255 }),
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0), // Tomans
    language: languageEnum('language').notNull().default('fa'),
    refCode: varchar('ref_code', { length: 12 }).notNull(),
    referredBy: integer('referred_by'),
    phone: varchar('phone', { length: 20 }),
    isAdmin: boolean('is_admin').notNull().default(false),
    isBlocked: boolean('is_blocked').notNull().default(false),
    phoneVerified: boolean('phone_verified').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_telegram_id_idx').on(table.telegramId),
    uniqueIndex('users_ref_code_idx').on(table.refCode),
  ],
);

// === Panels ===
export const panels = pgTable('panels', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  username: varchar('username', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('sanaei'),
  status: panelStatusEnum('status').notNull().default('active'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// === Inbounds (local catalog; panelInboundId is the 3x-ui id) ===
export const inbounds = pgTable('inbounds', {
  id: serial('id').primaryKey(),
  panelId: integer('panel_id')
    .notNull()
    .references(() => panels.id, { onDelete: 'cascade' }),
  /** Actual inbound id on the 3x-ui panel */
  panelInboundId: integer('panel_inbound_id'),
  remark: varchar('remark', { length: 255 }).notNull(),
  port: integer('port').notNull(),
  protocol: varchar('protocol', { length: 50 }).notNull(),
  settings: jsonb('settings').default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// === Categories ===
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// === Products ===
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  /**
   * 3x-ui panel inbound ID (NOT the local inbounds.id).
   * Stored as plain integer so admins can set the panel's inbound number directly.
   */
  inboundId: integer('inbound_id'),
  name: varchar('name', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }),
  description: text('description'),
  price: bigint('price', { mode: 'number' }).notNull(), // Tomans
  volumeGb: integer('volume_gb').notNull().default(0), // 0 = unlimited
  durationDays: integer('duration_days').notNull().default(30),
  protocol: varchar('protocol', { length: 50 }).default('vless'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// === Orders ===
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  /** 3x-ui panel inbound id used when the client was created */
  panelInboundId: integer('panel_inbound_id'),
  /** @deprecated use panelInboundId — kept for backward compatibility */
  panelUserId: integer('panel_user_id'),
  status: orderStatusEnum('status').notNull().default('pending'),
  configLink: text('config_link'),
  subLink: text('sub_link'),
  usernameOnPanel: varchar('username_on_panel', { length: 255 }),
  volumeGb: integer('volume_gb').notNull().default(0),
  durationDays: integer('duration_days').notNull().default(30),
  expireAt: timestamp('expire_at'),
  isTrial: boolean('is_trial').notNull().default(false),
  discountCode: varchar('discount_code', { length: 50 }),
  finalPrice: bigint('final_price', { mode: 'number' }).notNull().default(0),
  reminderSentAt: timestamp('reminder_sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  activatedAt: timestamp('activated_at'),
});

// === Payments ===
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  /** When purpose is product_purchase */
  productId: integer('product_id'),
  /** wallet_charge | product_purchase */
  purpose: varchar('purpose', { length: 32 }).notNull().default('wallet_charge'),
  gateway: paymentGatewayEnum('gateway').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  refId: varchar('ref_id', { length: 255 }),
  authority: varchar('authority', { length: 255 }),
  receiptPhoto: varchar('receipt_photo', { length: 500 }),
  description: text('description'),
  discountCode: varchar('discount_code', { length: 50 }),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// === Wallet Transactions ===
export const walletTransactions = pgTable('wallet_transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  type: walletTxTypeEnum('type').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// === Discount Codes ===
export const discountCodes = pgTable(
  'discount_codes',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).notNull(),
    percent: integer('percent').notNull(),
    maxUses: integer('max_uses').default(0), // 0 = unlimited
    usedCount: integer('used_count').notNull().default(0),
    expireAt: timestamp('expire_at'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('discount_codes_code_idx').on(table.code)],
);

// === Gift Codes ===
export const giftCodes = pgTable(
  'gift_codes',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' }),
    isUsed: boolean('is_used').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    usedAt: timestamp('used_at'),
  },
  (table) => [uniqueIndex('gift_codes_code_idx').on(table.code)],
);

// === Referrals ===
export const referrals = pgTable('referrals', {
  id: serial('id').primaryKey(),
  referrerId: integer('referrer_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  referredId: integer('referred_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  rewardAmount: bigint('reward_amount', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// === Settings (KV Store) ===
export const settings = pgTable(
  'settings',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 255 }).notNull(),
    value: text('value'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('settings_key_idx').on(table.key)],
);

// === Admins ===
export const admins = pgTable(
  'admins',
  {
    id: serial('id').primaryKey(),
    telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
    username: varchar('username', { length: 255 }),
    role: adminRoleEnum('role').notNull().default('admin'),
    loginUsername: varchar('login_username', { length: 100 }),
    loginPassword: varchar('login_password', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('admins_telegram_id_idx').on(table.telegramId)],
);

// === Lotteries ===
export const lotteries = pgTable('lotteries', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  prizeAmount: bigint('prize_amount', { mode: 'number' }).notNull(),
  winnerCount: integer('winner_count').notNull().default(1),
  entryFee: bigint('entry_fee', { mode: 'number' }).notNull().default(0),
  startAt: timestamp('start_at').notNull(),
  endAt: timestamp('end_at').notNull(),
  status: lotteryStatusEnum('status').notNull().default('pending'),
  winners: jsonb('winners').default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// === Lottery Entries ===
export const lotteryEntries = pgTable('lottery_entries', {
  id: serial('id').primaryKey(),
  lotteryId: integer('lottery_id')
    .notNull()
    .references(() => lotteries.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// === Messages (Customizable Bot Texts) ===
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 255 }).notNull(),
    faText: text('fa_text'),
    enText: text('en_text'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('messages_key_idx').on(table.key)],
);

// === Trials (one per user) ===
export const trials = pgTable(
  'trials',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id),
    orderId: integer('order_id').references(() => orders.id),
    expireAt: timestamp('expire_at').notNull(),
    usedAt: timestamp('used_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('trials_user_id_idx').on(table.userId)],
);

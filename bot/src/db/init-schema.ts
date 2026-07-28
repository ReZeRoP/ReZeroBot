/**
 * Embedded database schema SQL — compiled into dist/ so it's ALWAYS available.
 * All statements are idempotent (safe to run multiple times).
 */
export const INIT_SCHEMA_SQL = `
-- Enum types
DO $$ BEGIN CREATE TYPE "public"."admin_role" AS ENUM('owner', 'admin', 'support'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."language" AS ENUM('fa', 'en'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."lottery_status" AS ENUM('pending', 'active', 'drawn', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'active', 'expired', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."panel_status" AS ENUM('active', 'inactive'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."payment_gateway" AS ENUM('card', 'zarinpal', 'aqayepardakht', 'iranpay', 'nowpayments', 'plisio', 'tronado', 'wallet'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'rejected', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."wallet_tx_type" AS ENUM('charge', 'purchase', 'referral', 'cashback', 'gift', 'admin_adjust', 'lottery', 'refund'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend wallet_tx_type with refund if enum already existed without it
DO $$ BEGIN ALTER TYPE "public"."wallet_tx_type" ADD VALUE IF NOT EXISTS 'refund'; EXCEPTION WHEN others THEN null; END $$;

CREATE TABLE IF NOT EXISTS "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" varchar(255),
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"login_username" varchar(100),
	"login_password" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"name_en" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "discount_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"percent" integer NOT NULL,
	"max_uses" integer DEFAULT 0,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expire_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gift_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"amount" bigint NOT NULL,
	"used_by" integer,
	"is_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp
);

CREATE TABLE IF NOT EXISTS "panels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" varchar(500) NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'sanaei' NOT NULL,
	"status" "panel_status" DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inbounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"panel_id" integer NOT NULL,
	"panel_inbound_id" integer,
	"remark" varchar(255) NOT NULL,
	"port" integer NOT NULL,
	"protocol" varchar(50) NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lotteries" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"prize_amount" bigint NOT NULL,
	"winner_count" integer DEFAULT 1 NOT NULL,
	"entry_fee" bigint DEFAULT 0 NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"status" "lottery_status" DEFAULT 'pending' NOT NULL,
	"winners" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lottery_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"lottery_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"fa_text" text,
	"en_text" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"balance" bigint DEFAULT 0 NOT NULL,
	"language" "language" DEFAULT 'fa' NOT NULL,
	"ref_code" varchar(12) NOT NULL,
	"referred_by" integer,
	"phone" varchar(20),
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"inbound_id" integer,
	"name" varchar(255) NOT NULL,
	"name_en" varchar(255),
	"description" text,
	"price" bigint NOT NULL,
	"volume_gb" integer DEFAULT 0 NOT NULL,
	"duration_days" integer DEFAULT 30 NOT NULL,
	"protocol" varchar(50) DEFAULT 'vless',
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"panel_user_id" integer,
	"panel_inbound_id" integer,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"config_link" text,
	"sub_link" text,
	"username_on_panel" varchar(255),
	"volume_gb" integer DEFAULT 0 NOT NULL,
	"duration_days" integer DEFAULT 30 NOT NULL,
	"expire_at" timestamp,
	"is_trial" boolean DEFAULT false NOT NULL,
	"discount_code" varchar(50),
	"final_price" bigint DEFAULT 0 NOT NULL,
	"reminder_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp
);

CREATE TABLE IF NOT EXISTS "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"order_id" integer,
	"product_id" integer,
	"purpose" varchar(32) DEFAULT 'wallet_charge' NOT NULL,
	"gateway" "payment_gateway" NOT NULL,
	"amount" bigint NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"ref_id" varchar(255),
	"authority" varchar(255),
	"receipt_photo" varchar(500),
	"description" text,
	"discount_code" varchar(50),
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" integer NOT NULL,
	"referred_id" integer NOT NULL,
	"reward_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "trials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer,
	"order_id" integer,
	"expire_at" timestamp NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"type" "wallet_tx_type" NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Additive columns for upgrades from older schema
DO $$ BEGIN ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "panel_inbound_id" integer; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamp; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "product_id" integer; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "purpose" varchar(32) DEFAULT 'wallet_charge'; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "discount_code" varchar(50); EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inbounds" ADD COLUMN IF NOT EXISTS "panel_inbound_id" integer; EXCEPTION WHEN others THEN null; END $$;

-- Drop wrong FK on products.inbound_id if it pointed at local inbounds
DO $$ BEGIN ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_inbound_id_inbounds_id_fk"; EXCEPTION WHEN others THEN null; END $$;

-- Foreign keys
DO $$ BEGIN ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "inbounds" ADD CONSTRAINT "inbounds_panel_id_panels_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panels"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "lottery_entries" ADD CONSTRAINT "lottery_entries_lottery_id_lotteries_id_fk" FOREIGN KEY ("lottery_id") REFERENCES "public"."lotteries"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "lottery_entries" ADD CONSTRAINT "lottery_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_users_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "trials" ADD CONSTRAINT "trials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "trials" ADD CONSTRAINT "trials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "trials" ADD CONSTRAINT "trials_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_id_idx" ON "users" USING btree ("telegram_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_ref_code_idx" ON "users" USING btree ("ref_code");
CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_code_idx" ON "discount_codes" USING btree ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "gift_codes_code_idx" ON "gift_codes" USING btree ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "settings_key_idx" ON "settings" USING btree ("key");
CREATE UNIQUE INDEX IF NOT EXISTS "messages_key_idx" ON "messages" USING btree ("key");
CREATE UNIQUE INDEX IF NOT EXISTS "trials_user_id_idx" ON "trials" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "admins_telegram_id_idx" ON "admins" USING btree ("telegram_id");
`;

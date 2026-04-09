import { pool } from "./index";

export async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "license_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" text NOT NULL UNIQUE,
        "label" text,
        "key_type" text NOT NULL DEFAULT 'basic',
        "max_accounts" integer NOT NULL DEFAULT 3,
        "is_active" boolean NOT NULL DEFAULT true,
        "bound_device_id" text,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "feature_config" (
        "key_type" text PRIMARY KEY,
        "max_accounts" integer NOT NULL DEFAULT 3,
        "max_searches" integer NOT NULL DEFAULT 30,
        "min_delay_seconds" integer NOT NULL DEFAULT 5,
        "background_enabled" boolean NOT NULL DEFAULT false,
        "custom_queries_enabled" boolean NOT NULL DEFAULT false,
        "daily_set_enabled" boolean NOT NULL DEFAULT true,
        "pc_search_enabled" boolean NOT NULL DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS "device_cookies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "license_key_id" uuid NOT NULL REFERENCES "license_keys"("id") ON DELETE CASCADE,
        "device_id" text NOT NULL,
        "account_email" text NOT NULL,
        "account_name" text,
        "cookies" text NOT NULL,
        "updated_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE("license_key_id", "account_email")
      );

      CREATE TABLE IF NOT EXISTS "global_config" (
        "key" text PRIMARY KEY,
        "value" text NOT NULL
      );
    `);
    console.log("Database tables verified");
  } catch (e: any) {
    console.error("ensureTables failed:", e.message);
  } finally {
    client.release();
  }
}

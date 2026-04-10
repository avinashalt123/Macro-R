import { pool } from "./index";

const CREATE_TABLES_SQL = `
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
`;

export async function ensureTables(retries = 5): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let client;
    try {
      client = await pool.connect();
      await client.query(CREATE_TABLES_SQL);
      console.log("Database tables verified");
      return;
    } catch (e: any) {
      console.error(`ensureTables attempt ${attempt}/${retries} failed:`, e.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000 * attempt));
      }
    } finally {
      if (client) client.release();
    }
  }
  console.error("ensureTables failed after all retries");
}

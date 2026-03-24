import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { licenseKeysTable } from "./licenseKeys";

export const deviceCookiesTable = pgTable("device_cookies", {
  id: uuid("id").defaultRandom().primaryKey(),
  licenseKeyId: uuid("license_key_id").notNull().references(() => licenseKeysTable.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  accountEmail: text("account_email").notNull(),
  accountName: text("account_name"),
  cookies: text("cookies").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_key_email").on(table.licenseKeyId, table.accountEmail),
]);

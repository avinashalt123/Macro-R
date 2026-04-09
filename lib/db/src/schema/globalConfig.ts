import { pgTable, text } from "drizzle-orm/pg-core";

export const globalConfigTable = pgTable("global_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type GlobalConfig = typeof globalConfigTable.$inferSelect;

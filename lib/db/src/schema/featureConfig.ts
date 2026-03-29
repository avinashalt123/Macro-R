import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const featureConfigTable = pgTable("feature_config", {
  keyType: text("key_type").primaryKey(),
  maxAccounts: integer("max_accounts").notNull().default(3),
  maxSearches: integer("max_searches").notNull().default(30),
  minDelaySeconds: integer("min_delay_seconds").notNull().default(5),
  backgroundEnabled: boolean("background_enabled").notNull().default(false),
  customQueriesEnabled: boolean("custom_queries_enabled").notNull().default(false),
  dailySetEnabled: boolean("daily_set_enabled").notNull().default(true),
  pcSearchEnabled: boolean("pc_search_enabled").notNull().default(true),
});

export const insertFeatureConfigSchema = createInsertSchema(featureConfigTable);
export type InsertFeatureConfig = z.infer<typeof insertFeatureConfigSchema>;
export type FeatureConfig = typeof featureConfigTable.$inferSelect;

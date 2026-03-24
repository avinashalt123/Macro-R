CREATE TABLE "feature_config" (
	"key_type" text PRIMARY KEY NOT NULL,
	"max_accounts" integer DEFAULT 3 NOT NULL,
	"max_searches" integer DEFAULT 30 NOT NULL,
	"min_delay_seconds" integer DEFAULT 5 NOT NULL,
	"background_enabled" boolean DEFAULT false NOT NULL,
	"custom_queries_enabled" boolean DEFAULT false NOT NULL
);

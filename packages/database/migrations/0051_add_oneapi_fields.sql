-- Add OneAPI integration fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oneapi_user_id" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oneapi_token_encrypted" text;

-- Add feature_subscriptions table for tracking user feature access
CREATE TABLE IF NOT EXISTS "feature_subscriptions" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "feature_code" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "started_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  UNIQUE("user_id", "feature_code")
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_feature_subscriptions_user_id" ON "feature_subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_users_oneapi_user_id" ON "users"("oneapi_user_id");

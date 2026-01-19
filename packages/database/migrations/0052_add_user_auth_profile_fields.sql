-- Align users table with Better Auth profile requirements
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "real_name" text,
  ADD COLUMN IF NOT EXISTS "identity_status" text DEFAULT 'unverified' NOT NULL,
  ADD COLUMN IF NOT EXISTS "identity_verified_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "identity_provider" text,
  ADD COLUMN IF NOT EXISTS "identity_document_hash" text,
  ADD COLUMN IF NOT EXISTS "identity_document_last4" text;

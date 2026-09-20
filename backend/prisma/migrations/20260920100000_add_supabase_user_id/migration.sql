-- Migration: add_supabase_user_id
-- Adds supabaseUserId to User table for Supabase Auth integration.
-- Neon PostgreSQL remains the primary application database.
-- Supabase Auth UUID is mapped here for identity resolution.

-- AlterTable: add nullable supabaseUserId column
ALTER TABLE "User" ADD COLUMN "supabaseUserId" TEXT;

-- CreateIndex: unique constraint (one Neon user per Supabase identity)
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

-- CreateIndex: performance index for lookup by Supabase UUID
CREATE INDEX "User_supabaseUserId_idx" ON "User"("supabaseUserId");

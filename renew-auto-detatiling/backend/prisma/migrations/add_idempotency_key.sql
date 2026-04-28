-- Migration: Add idempotencyKey to NotificationQueue
-- Purpose: DB-enforced notification deduplication (unique constraint)
-- Safe: Column is nullable, existing rows unaffected

-- Step 1: Add column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'NotificationQueue'
        AND column_name = 'idempotencyKey'
    ) THEN
        ALTER TABLE "NotificationQueue" ADD COLUMN "idempotencyKey" TEXT;
    END IF;
END $$;

-- Step 2: Create unique index if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationQueue_idempotencyKey_key"
ON "NotificationQueue"("idempotencyKey");

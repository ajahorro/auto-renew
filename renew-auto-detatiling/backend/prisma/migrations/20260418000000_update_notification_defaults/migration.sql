-- Update notifyEmail default to false for User table
ALTER TABLE "User" ALTER COLUMN "notifyEmail" SET DEFAULT false;

-- Update existing NULL values to false
UPDATE "User" SET "notifyEmail" = false WHERE "notifyEmail" IS NULL;

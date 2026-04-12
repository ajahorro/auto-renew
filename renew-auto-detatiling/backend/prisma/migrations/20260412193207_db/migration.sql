-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "maxServicesPerBooking" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionType" TEXT,
ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "actorName" TEXT,
ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetName" TEXT;

-- CreateTable
CREATE TABLE "PendingRegistration" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");

-- CreateIndex
CREATE INDEX "PendingRegistration_email_idx" ON "PendingRegistration"("email");

-- CreateIndex
CREATE INDEX "PendingRegistration_otp_idx" ON "PendingRegistration"("otp");

-- CreateIndex
CREATE INDEX "Notification_actionType_idx" ON "Notification"("actionType");

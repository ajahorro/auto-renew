/*
  Warnings:

  - The values [PARTIALLY_PAID] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SUPER_ADMIN] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `price` on the `BookingItem` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - A unique constraint covering the columns `[bookingId,serviceId]` on the table `BookingItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `durationAtBooking` to the `BookingItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceAtBooking` to the `BookingItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceNameAtBooking` to the `BookingItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PARTIALLY PAID', 'PAID');
ALTER TABLE "Booking" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING ("paymentStatus"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPER ADMIN', 'ADMIN', 'STAFF', 'CUSTOMER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- DropForeignKey
ALTER TABLE "AddonRequest" DROP CONSTRAINT "AddonRequest_bookingId_fkey";

-- DropIndex
DROP INDEX "Service_active_idx";

-- DropIndex
DROP INDEX "Service_category_idx";

-- DropIndex
DROP INDEX "Service_name_key";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "downpaymentAmount" DECIMAL(10,2),
ADD COLUMN     "downpaymentRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "BookingItem" DROP COLUMN "price",
ADD COLUMN     "durationAtBooking" INTEGER NOT NULL,
ADD COLUMN     "priceAtBooking" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "serviceNameAtBooking" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");

-- CreateIndex
CREATE INDEX "Booking_downpaymentRequested_idx" ON "Booking"("downpaymentRequested");

-- CreateIndex
CREATE UNIQUE INDEX "BookingItem_bookingId_serviceId_key" ON "BookingItem"("bookingId", "serviceId");

-- AddForeignKey
ALTER TABLE "AddonRequest" ADD CONSTRAINT "AddonRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

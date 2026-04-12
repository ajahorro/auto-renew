/*
  Warnings:

  - You are about to alter the column `totalAmount` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `amountPaid` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `price` on the `Service` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "totalAmount" SET DEFAULT 0,
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "amountPaid" SET DEFAULT 0,
ALTER COLUMN "amountPaid" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);

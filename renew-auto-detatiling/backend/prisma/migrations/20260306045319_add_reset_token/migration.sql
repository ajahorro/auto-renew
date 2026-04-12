/*
  Warnings:

  - Added the required column `category` to the `Service` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Service` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('EXTERIOR', 'INTERIOR', 'SPECIALIZED');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "category" "ServiceCategory" NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "Service"("category");

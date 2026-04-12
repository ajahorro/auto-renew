-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "oneHourReminderSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "plateNumber" TEXT,
ADD COLUMN     "sameDayReminderSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vehicleBrand" TEXT,
ADD COLUMN     "vehicleModel" TEXT,
ADD COLUMN     "vehicleType" TEXT;

-- CreateTable
CREATE TABLE "AddonRequest" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "services" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddonRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AddonRequest" ADD CONSTRAINT "AddonRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

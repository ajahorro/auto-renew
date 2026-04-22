const prisma = require("./prisma");

async function normalizeLegacyBookingData() {
  const updates = [
    {
      label: "booking refundStatus",
      query: `
        UPDATE "Booking"
        SET "refundStatus" = 'NONE'::"RefundStatus"
        WHERE "refundStatus"::text = 'none'
      `
    },
    {
      label: "booking paymentStatus",
      query: `
        UPDATE "Booking"
        SET "paymentStatus" = 'PENDING'
        WHERE "paymentStatus"::text IN ('UNPAID', 'unpaid')
      `
    },
    {
      label: "booking status PENDING → SCHEDULED",
      query: `
        UPDATE "Booking"
        SET "status" = 'SCHEDULED'::"BookingStatus"
        WHERE "status"::text = 'PENDING'
        AND "status"::text != 'CANCELLED'
        AND "status"::text != 'COMPLETED'
      `
    },
    {
      label: "booking status CONFIRMED → SCHEDULED",
      query: `
        UPDATE "Booking"
        SET "status" = 'SCHEDULED'::"BookingStatus"
        WHERE "status"::text = 'CONFIRMED'
        AND "status"::text != 'CANCELLED'
        AND "status"::text != 'COMPLETED'
      `
    },
    {
      label: "sync serviceStatus ONGOING",
      query: `
        UPDATE "Booking"
        SET "serviceStatus" = 'ONGOING'::"ServiceStatus"
        WHERE "status"::text = 'ONGOING'
        AND "serviceStatus" != 'ONGOING'
      `
    },
    {
      label: "sync serviceStatus COMPLETED",
      query: `
        UPDATE "Booking"
        SET "serviceStatus" = 'COMPLETED'::"ServiceStatus"
        WHERE "status"::text = 'COMPLETED'
        AND "serviceStatus" != 'COMPLETED'
      `
    }
  ];

  try {
    for (const update of updates) {
      const affectedRows = await prisma.$executeRawUnsafe(update.query);
      if (affectedRows > 0) {
        console.log(`[normalizeLegacyBookingData] Updated ${affectedRows} rows for ${update.label}`);
      }
    }
  } catch (error) {
    console.error("Failed to normalize legacy booking data:", error.message);
  }
}

module.exports = normalizeLegacyBookingData;
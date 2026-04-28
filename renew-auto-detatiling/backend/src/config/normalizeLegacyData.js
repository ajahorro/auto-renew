const prisma = require("./prisma");

/**
 * Normalize any legacy data that may exist in the database.
 * This runs on server startup and is idempotent.
 * All queries use the CURRENT valid enum values.
 */
async function normalizeLegacyBookingData() {
  const updates = [
    {
      label: "booking refundStatus: legacy NONE -> skip (no longer valid enum value)",
      // RefundStatus no longer has NONE. Records with invalid values are left as-is.
      // Handled by force-reset. This is a no-op.
      query: null
    },
    {
      label: "booking paymentStatus: PENDING -> UNPAID",
      // PENDING was renamed to UNPAID. This handles any remaining records.
      query: `
        UPDATE "Booking"
        SET "paymentStatus" = 'UNPAID'::"PaymentStatus"
        WHERE "paymentStatus"::text = 'PENDING'
      `
    },
    {
      label: "service status: IN_PROGRESS sync with ONGOING booking",
      // If booking is ONGOING, service should be IN_PROGRESS at minimum
      query: `
        UPDATE "Booking"
        SET "serviceStatus" = 'IN_PROGRESS'::"ServiceStatus"
        WHERE "status"::text = 'ONGOING'
        AND "serviceStatus"::text = 'NOT_STARTED'
      `
    },
    {
      label: "service status: FINISHED sync with COMPLETED booking",
      query: `
        UPDATE "Booking"
        SET "serviceStatus" = 'FINISHED'::"ServiceStatus"
        WHERE "status"::text = 'COMPLETED'
        AND "serviceStatus"::text != 'FINISHED'
      `
    }
  ];

  try {
    for (const update of updates) {
      if (!update.query) continue;
      const affectedRows = await prisma.$executeRawUnsafe(update.query);
      if (affectedRows > 0) {
        console.log(`[normalizeLegacyBookingData] Updated ${affectedRows} rows for: ${update.label}`);
      }
    }
  } catch (error) {
    console.error("Failed to normalize legacy booking data:", error.message);
  }
}

module.exports = normalizeLegacyBookingData;
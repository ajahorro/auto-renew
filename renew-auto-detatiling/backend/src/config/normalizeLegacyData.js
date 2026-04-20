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
    }
  ];

  for (const update of updates) {
    const affectedRows = await prisma.$executeRawUnsafe(update.query);
    if (affectedRows > 0) {
      console.log(`[normalizeLegacyBookingData] Updated ${affectedRows} rows for ${update.label}`);
    }
  }
}

module.exports = normalizeLegacyBookingData;
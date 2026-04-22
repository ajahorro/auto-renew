const prisma = require("../config/prisma");

/**
 * Synchronises booking lifecycle states.
 *
 * Runs as a scheduled cron job (NOT on read requests) to keep booking
 * statuses accurate without coupling writes to reads.
 *
 * Rules:
 *  1. Fully-paid bookings past their end time → COMPLETED + locked
 *  2. Unpaid bookings past their end time    → COMPLETED + NOT locked
 *     (so admin/staff can still record remaining payment)
 *  3. PENDING bookings whose start date has passed → CANCELLED
 *     (they were never confirmed, so the service didn't happen)
 */
async function syncBookingLifecycleStates() {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // ── 1 & 2: Bookings past their appointment end ──────────────────
    // Prisma can't compare two columns in `where`, so we fetch and
    // branch on the payment check per-booking.
    const pastEndBookings = await prisma.booking.findMany({
      where: {
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        appointmentEnd: { lte: now }
      },
      select: {
        id: true,
        totalAmount: true,
        amountPaid: true
      }
    });

    const paidIds = pastEndBookings
      .filter(b => (Number(b.amountPaid) || 0) >= (Number(b.totalAmount) || 0) && Number(b.totalAmount) > 0)
      .map(b => b.id);
    
    const unpaidIds = pastEndBookings
      .filter(b => !paidIds.includes(b.id))
      .map(b => b.id);

    if (paidIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: paidIds } },
        data: { status: "COMPLETED", serviceStatus: "COMPLETED", isLocked: true }
      });
    }

    if (unpaidIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: unpaidIds } },
        data: { status: "COMPLETED", serviceStatus: "COMPLETED", isLocked: false }
      });
    }

    completedPaid = paidIds.length;
    completedUnpaid = unpaidIds.length;

    // ── 3: Stale active bookings whose appointment already started ────
    // Covers both legacy PENDING and new SCHEDULED statuses
    const stalePending = await prisma.booking.updateMany({
      where: {
        status: { in: ["PENDING", "SCHEDULED", "CONFIRMED"] },
        appointmentStart: { lt: startOfToday }
      },
      data: {
        status: "CANCELLED",
        isLocked: true,
        cancellationReason: "Auto-cancelled: appointment date passed without service delivery"
      }
    });

    // Only log when something actually changed
    if (completedPaid + completedUnpaid + stalePending.count > 0) {
      console.log(
        `[LIFECYCLE SYNC] Completed ${completedPaid} paid, ${completedUnpaid} unpaid, cancelled ${stalePending.count} stale pending`
      );
    }
  } catch (error) {
    console.error("BOOKING LIFECYCLE SYNC ERROR:", error);
  }
}

module.exports = syncBookingLifecycleStates;

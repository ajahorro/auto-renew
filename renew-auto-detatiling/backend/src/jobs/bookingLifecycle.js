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

    let completedPaid = 0;
    let completedUnpaid = 0;

    for (const booking of pastEndBookings) {
      const paid = Number(booking.amountPaid) || 0;
      const total = Number(booking.totalAmount) || 0;

      if (total > 0 && paid >= total) {
        // Fully paid → complete and lock
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED", isLocked: true }
        });
        completedPaid++;
      } else {
        // Unpaid → complete but keep unlocked for payment recording
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED", isLocked: false }
        });
        completedUnpaid++;
      }
    }

    // ── 3: Stale PENDING bookings ────────────────────────────────────
    const stalePending = await prisma.booking.updateMany({
      where: {
        status: "PENDING",
        appointmentStart: { lt: startOfToday }
      },
      data: {
        status: "CANCELLED",
        isLocked: true,
        cancellationReason: "Auto-cancelled: appointment time passed without confirmation"
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

const prisma = require("../config/prisma");
const auditService = require("../services/audit.service");
const notificationQueue = require("../services/notificationQueue.service");

/**
 * Booking Lifecycle Cron Job (runs every 15 minutes)
 * PATCH 2: Cancellation uses ONLY computed values, no DB-level paymentStatus filtering.
 */
async function syncBookingLifecycleStates() {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      // =============================================
      // 1. AUTO-CANCELLATION (PATCH 2: Single Source of Truth)
      // Relies ONLY on computed verifiedSum and FOR_VERIFICATION check.
      // NO DB-level paymentStatus filtering.
      // =============================================
      const confirmedBookings = await prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          createdAt: { lte: twentyFourHoursAgo },
          archivedAt: null,
          // PATCH 3: Scheduler hard filter — skip refunded bookings
          refundStatus: { not: "PROCESSED" }
        },
        include: {
          payments: { select: { id: true, status: true, amount: true } }
        }
      });

      let cancelCount = 0;
      for (const booking of confirmedBookings) {
        // PATCH 2: Compute from payment records only
        const verifiedSum = booking.payments
          .filter(p => ["PAID", "APPROVED", "VERIFIED", "COMPLETED"].includes(p.status))
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const hasPendingVerification = booking.payments
          .some(p => p.status === "FOR_VERIFICATION");

        // Cancel ONLY if verifiedSum == 0 AND no FOR_VERIFICATION
        if (verifiedSum > 0 || hasPendingVerification) continue;

        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { 
              status: "CANCELLED",
              serviceStatus: "NOT_STARTED",
              cancellationReason: "Auto-cancelled: No verified payment within 24 hours of confirmation.",
              cancelledAt: new Date()
            }
          });

          await auditService.logAction(tx, {
            bookingId: booking.id,
            action: "AUTO_CANCEL_NO_PAYMENT",
            entityType: "BOOKING",
            entityId: booking.id.toString(),
            oldValue: { status: "CONFIRMED", verifiedSum, hasPendingVerification },
            newValue: { status: "CANCELLED", serviceStatus: "NOT_STARTED" },
            details: `System auto-cancelled: verifiedSum=${verifiedSum}, pendingVerification=${hasPendingVerification}.`
          });

          await notificationQueue.queue({
            userId: booking.customerId,
            title: "Booking Cancelled",
            message: "Your booking has been auto-cancelled because no payment was verified within 24 hours.",
            type: "SYSTEM_CANCEL",
            entityId: booking.id.toString()
          });
        });
        cancelCount++;
      }

      // =============================================
      // 2. PENDING CLEANUP (Archive, not Cancel)
      // PATCH 3: Archived bookings are immutable after this
      // =============================================
      const stalePendingBookings = await prisma.booking.findMany({
        where: {
          status: "PENDING",
          archivedAt: null,
          // PATCH 3: Scheduler hard filter
          refundStatus: { not: "PROCESSED" },
          createdAt: { lte: twentyFourHoursAgo },
          payments: { none: {} },
          customer: { emailVerified: false }
        }
      });

      for (const b of stalePendingBookings) {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: b.id },
            data: {
              isLocked: true,
              archivedAt: new Date(),
              archiveReason: "System cleanup: Pending booking expired after 24 hours (No payment/No verification)."
            }
          });

          await auditService.logAction(tx, {
            bookingId: b.id,
            action: "PENDING_ARCHIVED",
            entityType: "BOOKING",
            entityId: b.id.toString(),
            oldValue: { status: "PENDING", archived: false },
            newValue: { status: "PENDING", archived: true },
            details: "System archived stale pending booking (24h, no payment, unverified user)."
          });
        });
      }

      if (cancelCount + stalePendingBookings.length > 0) {
        console.log(`[LIFECYCLE] Cancelled: ${cancelCount}, Archived: ${stalePendingBookings.length}`);
      }
    } catch (innerError) {
      if (innerError?.code === "PrismaClientValidationError" || innerError?.name === "PrismaClientValidationError") {
        console.log("[LIFECYCLE] Skipping - schema validation issue");
      } else if (innerError?.code?.includes?.("P20")) {
        console.log("[LIFECYCLE] Skipping - schema mismatch detected");
      } else {
        throw innerError;
      }
    }

  } catch (error) {
    console.error("BOOKING LIFECYCLE SYNC ERROR:", error);
  }
}

module.exports = syncBookingLifecycleStates;

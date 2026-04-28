const prisma = require("../config/prisma");
const notificationQueue = require("../services/notificationQueue.service");

/**
 * Start Reminder Job
 * Triggers 5 minutes after scheduled start time if service hasn't started.
 */
async function processStartReminders() {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    try {
      // We look for bookings scheduled to start between 10 and 5 minutes ago
      // that are still NOT_STARTED or only CONFIRMED.
      const delayedBookings = await prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          serviceStatus: "NOT_STARTED",
          // PATCH 3: Scheduler hard filter — skip archived/refunded
          archivedAt: null,
          refundStatus: { not: "PROCESSED" },
          appointmentStart: {
            lte: fiveMinutesAgo,
            gte: new Date(now.getTime() - 60 * 60 * 1000)
          },
          NOT: {
            auditLogs: {
              some: { action: "START_REMINDER_SENT" }
            }
          }
        },
        include: {
          assignedStaff: true
        }
      });

      for (const booking of delayedBookings) {
        // Notify Staff
        if (booking.assignedStaffId) {
          await notificationQueue.queue({
            userId: booking.assignedStaffId,
            title: "Service Start Reminder",
            message: `Booking #${booking.id} was scheduled to start 5 minutes ago. Please update the status.`,
            type: "REMINDER"
          });
        }

        // Notify Admins
        const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
        for (const admin of admins) {
          await notificationQueue.queue({
            userId: admin.id,
            title: "Delayed Service Alert",
            message: `Booking #${booking.id} has not started yet (5 min delay). Assigned to: ${booking.assignedStaff?.fullName || "Unassigned"}`,
            type: "ALERT"
          });
        }

        // Mark as reminded via Audit Log to avoid double notification
        await prisma.auditLog.create({
          data: {
            bookingId: booking.id,
            action: "START_REMINDER_SENT",
          entityType: "BOOKING",
          entityId: booking.id.toString(),
          details: "5-minute start reminder sent to staff and admin."
        }
      });
    }
    } catch (innerError) {
      // If AuditLog or User table doesn't exist, silently skip
      if (innerError?.code === "P2021") {
        console.log("[StartReminder] Skipping - missing table in database");
      } else {
        throw innerError;
      }
    }

  } catch (error) {
    console.error("START REMINDER JOB ERROR:", error);
  }
}

module.exports = processStartReminders;

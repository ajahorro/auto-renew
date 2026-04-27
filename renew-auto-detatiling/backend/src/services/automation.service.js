const prisma = require("../config/prisma");
const { createAuditLog } = require("./audit.service");
const { createNotification, notifyAdmins, processPendingNotifications } = require("./notification.service");
const { requestRefund } = require("./refund.service");
const { BOOKING_STATUS, SERVICE_STATUS, getBusinessSettings, recomputeBookingState, VERIFIED_PAYMENT_STATUSES } = require("./domain.service");

async function autoCancelUnpaidScheduledBookings() {
  const settings = await getBusinessSettings();
  const threshold = new Date(Date.now() - settings.paymentGracePeriodHours * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: BOOKING_STATUS.SCHEDULED,
      OR: [
        { paymentDeadlineAt: { lte: new Date() } },
        { paymentDeadlineAt: null, createdAt: { lte: threshold } }
      ],
      archivedAt: null
    },
    include: { payments: true }
  });

  let count = 0;
  for (const booking of bookings) {
    const hasValidPayment = booking.payments.some((payment) => VERIFIED_PAYMENT_STATUSES.has(payment.status));
    if (hasValidPayment) {
      continue;
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BOOKING_STATUS.CANCELLED,
        serviceStatus: SERVICE_STATUS.NOT_STARTED,
        cancelledAt: new Date(),
        cancellationReason: "Auto-cancelled after 24 hours without valid payment"
      }
    });

    await createAuditLog({
      action: "AUTO_CANCELLED_FOR_NON_PAYMENT",
      entityType: "Booking",
      entityId: String(booking.id),
      bookingId: booking.id,
      details: "Booking auto-cancelled because no valid payment was received within the allowed window"
    });

    await createNotification(booking.customerId, {
      title: "Booking Cancelled",
      message: `Booking #${booking.id} was cancelled because no valid payment was received within 24 hours.`,
      type: "BOOKING",
      actionType: "BOOKING_AUTO_CANCELLED",
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`,
      enableSms: true
    });

    count += 1;
  }

  return count;
}

async function archivePendingBookings() {
  const settings = await getBusinessSettings();
  const threshold = new Date(Date.now() - settings.pendingCleanupHours * 60 * 60 * 1000);
  const pendingBookings = await prisma.booking.findMany({
    where: {
      status: BOOKING_STATUS.PENDING,
      createdAt: { lte: threshold },
      archivedAt: null
    }
  });

  for (const booking of pendingBookings) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        archivedAt: new Date(),
        archiveReason: "Archived automatically after remaining pending for more than 24 hours"
      }
    });

    await createAuditLog({
      action: "PENDING_BOOKING_ARCHIVED",
      entityType: "Booking",
      entityId: String(booking.id),
      bookingId: booking.id,
      details: "Pending booking archived by cleanup job"
    });
  }

  return pendingBookings.length;
}

async function sendLateStartReminders() {
  const settings = await getBusinessSettings();
  const threshold = new Date(Date.now() - settings.startReminderDelayMinutes * 60 * 1000);
  const bookings = await prisma.booking.findMany({
    where: {
      status: BOOKING_STATUS.SCHEDULED,
      serviceStatus: SERVICE_STATUS.NOT_STARTED,
      startReminderSent: false,
      appointmentStart: { lte: threshold },
      archivedAt: null
    },
    include: {
      assignedStaff: {
        select: { id: true, fullName: true }
      }
    }
  });

  for (const booking of bookings) {
    if (booking.assignedStaffId) {
      await createNotification(booking.assignedStaffId, {
        title: "Start Reminder",
        message: `Booking #${booking.id} was due to start 5 minutes ago.`,
        type: "REMINDER",
        actionType: "SERVICE_START_DELAY",
        targetId: String(booking.id),
        targetName: `Booking #${booking.id}`,
        enableSms: true
      });
    }

    await notifyAdmins({
      title: "Service Start Reminder",
      message: `Booking #${booking.id} has not started 5 minutes after the scheduled time.`,
      type: "REMINDER",
      actionType: "SERVICE_START_DELAY",
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`,
      enableSms: true
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { startReminderSent: true }
    });
  }

  return bookings.length;
}

async function syncDerivedBookingStatuses() {
  const bookings = await prisma.booking.findMany({
    where: {
      archivedAt: null,
      status: { not: BOOKING_STATUS.CANCELLED }
    },
    select: { id: true }
  });

  let synced = 0;
  for (const booking of bookings) {
    try {
      await prisma.$transaction(async (tx) => {
        await recomputeBookingState(tx, booking.id);
      });
      synced += 1;
    } catch (error) {
      if (!String(error.message).includes("Cannot complete booking")) {
        throw error;
      }
    }
  }

  return synced;
}

async function ensureRefundsForCancelledBookings() {
  const bookings = await prisma.booking.findMany({
    where: {
      status: BOOKING_STATUS.CANCELLED,
      refundStatus: { in: ["NONE", "FORFEITED"] }
    }
  });

  let created = 0;
  for (const booking of bookings) {
    try {
      await requestRefund(booking.id, null, booking.cancellationReason);
      created += 1;
    } catch (error) {
      if (!String(error.message).includes("does not have verified payments")) {
        throw error;
      }
    }
  }

  return created;
}

async function runAutomationCycle() {
  const [synced, autoCancelled, archived, reminders, refundsCreated, dispatches] = await Promise.all([
    syncDerivedBookingStatuses(),
    autoCancelUnpaidScheduledBookings(),
    archivePendingBookings(),
    sendLateStartReminders(),
    ensureRefundsForCancelledBookings(),
    processPendingNotifications()
  ]);

  return {
    synced,
    autoCancelled,
    archived,
    reminders,
    refundsCreated,
    dispatches
  };
}

module.exports = {
  autoCancelUnpaidScheduledBookings,
  archivePendingBookings,
  sendLateStartReminders,
  syncDerivedBookingStatuses,
  ensureRefundsForCancelledBookings,
  runAutomationCycle
};

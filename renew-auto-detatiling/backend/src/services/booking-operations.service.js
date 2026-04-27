const prisma = require("../config/prisma");
const { createAuditLog } = require("./audit.service");
const { createNotification, notifyAdmins } = require("./notification.service");
const {
  BOOKING_STATUS,
  SERVICE_STATUS,
  startBookingService,
  completeBookingService
} = require("./domain.service");
const { requestRefund } = require("./refund.service");

async function updateServiceStatus(bookingId, serviceStatus, actor, overrideReason = null) {
  const normalizedStatus = String(serviceStatus || "").toUpperCase();
  if (![SERVICE_STATUS.ONGOING, SERVICE_STATUS.COMPLETED].includes(normalizedStatus)) {
    throw new Error("Unsupported service status transition");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: Number(bookingId) },
    include: {
      customer: {
        select: { id: true, fullName: true, email: true, phone: true }
      }
    }
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (actor.role === "STAFF" && String(booking.assignedStaffId || "") !== String(actor.id)) {
    throw new Error("Staff can only update their assigned bookings");
  }

  let result;
  if (normalizedStatus === SERVICE_STATUS.ONGOING) {
    result = await prisma.$transaction(async (tx) => startBookingService(tx, booking.id));
  } else {
    result = await prisma.$transaction(async (tx) => {
      const completion = await completeBookingService(tx, booking.id, overrideReason ? {
        adminOverrideBy: actor.id,
        reason: overrideReason
      } : null);
      return completion.updatedBooking;
    });
  }

  await createAuditLog({
    userId: actor.id,
    action: normalizedStatus === SERVICE_STATUS.ONGOING ? "SERVICE_STARTED" : overrideReason ? "SERVICE_COMPLETED_WITH_OVERRIDE" : "SERVICE_COMPLETED",
    entityType: "Booking",
    entityId: String(booking.id),
    bookingId: booking.id,
    details: `Booking #${booking.id} moved to ${normalizedStatus}${overrideReason ? ` with override reason: ${overrideReason}` : ""}`
  });

  await createNotification(booking.customerId, {
    title: normalizedStatus === SERVICE_STATUS.ONGOING ? "Service Started" : "Service Completed",
    message: normalizedStatus === SERVICE_STATUS.ONGOING
      ? `Service for booking #${booking.id} has started.`
      : `Service for booking #${booking.id} has been completed.`,
    type: "BOOKING",
    actionType: normalizedStatus === SERVICE_STATUS.ONGOING ? "SERVICE_STARTED" : "SERVICE_COMPLETED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`,
    enableSms: true
  });

  if (overrideReason) {
    await notifyAdmins({
      title: "Admin Override Used",
      message: `Booking #${booking.id} was completed with an admin override. Reason: ${overrideReason}`,
      type: "BOOKING",
      actionType: "ADMIN_OVERRIDE",
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`,
      enableSms: true
    });
  }

  return result;
}

async function cancelBookingAndCreateRefund(bookingId, actor, reason) {
  const booking = await prisma.booking.findUnique({
    where: { id: Number(bookingId) },
    include: {
      customer: {
        select: { id: true, fullName: true }
      }
    }
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(booking.status)) {
    throw new Error("Booking cannot be cancelled from its current state");
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BOOKING_STATUS.CANCELLED,
      serviceStatus: SERVICE_STATUS.NOT_STARTED,
      cancelledAt: new Date(),
      cancelledBy: actor?.id || null,
      cancellationReason: reason || "Booking cancelled"
    }
  });

  try {
    await requestRefund(booking.id, actor, reason);
  } catch (error) {
    if (!String(error.message).includes("does not have verified payments")) {
      throw error;
    }
  }

  return updated;
}

async function getBookingTimeline(bookingId, actor) {
  const booking = await prisma.booking.findUnique({
    where: { id: Number(bookingId) },
    include: {
      customer: {
        select: { id: true }
      }
    }
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (actor.role === "CUSTOMER" && String(booking.customerId) !== String(actor.id)) {
    throw new Error("Unauthorized");
  }

  if (actor.role === "STAFF" && String(booking.assignedStaffId || "") !== String(actor.id)) {
    throw new Error("Unauthorized");
  }

  const [auditLogs, payments, refunds] = await Promise.all([
    prisma.auditLog.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" }
    }),
    prisma.payment.findMany({
      where: { bookingId: booking.id },
      include: { ocrResult: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.refund.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" }
    })
  ]);

  return {
    booking,
    timeline: [
      ...auditLogs.map((entry) => ({
        at: entry.createdAt,
        type: "AUDIT",
        action: entry.action,
        details: entry.details
      })),
      ...payments.map((payment) => ({
        at: payment.createdAt,
        type: "PAYMENT",
        action: payment.status,
        details: `${payment.method} payment of PHP ${Number(payment.amount).toFixed(2)}`
      })),
      ...refunds.map((refund) => ({
        at: refund.createdAt,
        type: "REFUND",
        action: refund.status,
        details: `Refund of PHP ${Number(refund.amount).toFixed(2)}`
      }))
    ].sort((a, b) => new Date(a.at) - new Date(b.at))
  };
}

module.exports = {
  updateServiceStatus,
  cancelBookingAndCreateRefund,
  getBookingTimeline
};

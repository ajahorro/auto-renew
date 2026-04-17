const prisma = require("../config/prisma");

async function createNotification(userId, data) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.notifyWeb) return;

  try {
    return await prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type || "GENERAL",
        actionType: data.actionType,
        targetId: data.targetId,
        targetName: data.targetName,
        actorId: data.actorId,
        actorName: data.actorName,
        relatedId: data.relatedId
      }
    });
  } catch (error) {
    console.error("Notification error:", error.message);
  }
}

async function notifyBookingCreated(booking, customer) {
  await createNotification(customer.id, {
    title: "Booking Received",
    message: `Your booking request for ${new Date(booking.appointmentStart).toLocaleDateString()} has been received.`,
    type: "BOOKING",
    actionType: "CREATED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
  });

  for (const admin of admins) {
    await createNotification(admin.id, {
      title: "New Booking",
      message: `New booking from ${customer.fullName}. Total: ₱${Number(booking.totalAmount).toLocaleString()}`,
      type: "BOOKING",
      actionType: "CREATED",
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`,
      actorId: customer.id,
      actorName: customer.fullName
    });
  }
}

async function notifyPaymentSubmitted(payment, booking, user) {
  await createNotification(user.id, {
    title: "Payment Submitted",
    message: `Payment of ₱${Number(payment.amount).toLocaleString()} submitted for booking #${booking.id}`,
    type: "PAYMENT",
    actionType: "SUBMITTED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
  });

  for (const admin of admins) {
    await createNotification(admin.id, {
      title: "Payment Pending Verification",
      message: `₱${Number(payment.amount).toLocaleString()} payment submitted for Booking #${booking.id}`,
      type: "PAYMENT",
      actionType: "SUBMITTED",
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`
    });
  }
}

async function notifyPaymentApproved(payment, booking, user) {
  await createNotification(user.id, {
    title: "Payment Approved",
    message: `Payment of ₱${Number(payment.amount).toLocaleString()} for Booking #${booking.id} has been approved.`,
    type: "PAYMENT",
    actionType: "APPROVED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`
  });
}

async function notifyPaymentRejected(payment, booking, user, reason) {
  await createNotification(user.id, {
    title: "Payment Rejected",
    message: `Payment for Booking #${booking.id} was rejected. Reason: ${reason}`,
    type: "PAYMENT",
    actionType: "REJECTED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`
  });
}

async function notifyCancellationRequested(booking, customer, reason) {
  await createNotification(customer.id, {
    title: "Cancellation Requested",
    message: `Your cancellation request for Booking #${booking.id} has been submitted.`,
    type: "BOOKING",
    actionType: "CANCELLATION_REQUESTED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
  });

  for (const admin of admins) {
    await createNotification(admin.id, {
      title: "Cancellation Request",
      message: `Cancellation request from ${customer.fullName} for Booking #${booking.id}`,
      type: "BOOKING",
      actionType: "CANCELLATION_REQUESTED",
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`,
      actorId: customer.id,
      actorName: customer.fullName
    });
  }
}

async function notifyCancellationApproved(booking, user, adminNote = "") {
  await createNotification(user.id, {
    title: "Cancellation Approved",
    message: `Your cancellation for Booking #${booking.id} has been approved.${adminNote ? ` Note: ${adminNote}` : ""}`,
    type: "BOOKING",
    actionType: "CANCELLATION_APPROVED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`
  });
}

async function notifyCancellationRejected(booking, user, adminNote = "") {
  await createNotification(user.id, {
    title: "Cancellation Rejected",
    message: `Your cancellation request for Booking #${booking.id} was rejected.${adminNote ? ` Reason: ${adminNote}` : ""}`,
    type: "BOOKING",
    actionType: "CANCELLATION_REJECTED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`
  });
}

async function notifyRefundProcessed(booking, user) {
  await createNotification(user.id, {
    title: "Refund Processed",
    message: `Refund of ₱${Number(booking.refundAmount).toLocaleString()} for Booking #${booking.id} has been processed.`,
    type: "PAYMENT",
    actionType: "REFUND_PROCESSED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`
  });
}

async function notifyStatusChanged(booking, oldStatus, newStatus, user) {
  await createNotification(user.id, {
    title: "Booking Status Updated",
    message: `Booking #${booking.id} status changed from ${oldStatus} to ${newStatus}`,
    type: "BOOKING",
    actionType: "STATUS_CHANGED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`
  });
}

module.exports = {
  createNotification,
  notifyBookingCreated,
  notifyPaymentSubmitted,
  notifyPaymentApproved,
  notifyPaymentRejected,
  notifyCancellationRequested,
  notifyCancellationApproved,
  notifyCancellationRejected,
  notifyRefundProcessed,
  notifyStatusChanged
};
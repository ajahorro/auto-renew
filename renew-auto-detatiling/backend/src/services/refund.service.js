const prisma = require("../config/prisma");
const { createAuditLog } = require("./audit.service");
const { createNotification, notifyAdmins } = require("./notification.service");
const { VERIFIED_PAYMENT_STATUSES, toNumber } = require("./domain.service");

async function calculateRefundAmount(bookingId, tx = prisma) {
  const booking = await tx.booking.findUnique({
    where: { id: Number(bookingId) },
    include: {
      payments: true
    }
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  const verifiedPayments = booking.payments.filter((payment) => VERIFIED_PAYMENT_STATUSES.has(payment.status));
  const totalPaid = verifiedPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  return {
    booking,
    totalPaid: Number(totalPaid.toFixed(2)),
    refundAmount: Number(totalPaid.toFixed(2))
  };
}

async function requestRefund(bookingId, actor, reason) {
  const calculation = await calculateRefundAmount(bookingId);
  if (calculation.refundAmount <= 0) {
    throw new Error("Booking does not have verified payments to refund");
  }

  const existingRefund = await prisma.refund.findFirst({
    where: {
      bookingId: Number(bookingId),
      status: "PENDING"
    }
  });

  if (existingRefund) {
    return existingRefund;
  }

  const refund = await prisma.$transaction(async (tx) => {
    const created = await tx.refund.create({
      data: {
        bookingId: Number(bookingId),
        requestedBy: actor?.id || null,
        amount: calculation.refundAmount,
        reason: reason || "Customer cancellation with verified payment",
        status: "PENDING"
      }
    });

    await tx.booking.update({
      where: { id: Number(bookingId) },
      data: {
        refundStatus: "PENDING",
        refundAmount: calculation.refundAmount
      }
    });

    return created;
  });

  await createAuditLog({
    userId: actor?.id || null,
    action: "REFUND_REQUESTED",
    entityType: "Refund",
    entityId: String(refund.id),
    bookingId: Number(bookingId),
    newValue: {
      amount: calculation.refundAmount,
      status: "PENDING"
    },
    details: `Refund requested for booking #${bookingId}`
  });

  await notifyAdmins({
    title: "Refund Pending Review",
    message: `Booking #${bookingId} has a pending refund of PHP ${calculation.refundAmount.toFixed(2)}.`,
    type: "REFUND",
    actionType: "REFUND_PENDING",
    targetId: String(bookingId),
    targetName: `Booking #${bookingId}`,
    enableSms: true
  });

  return refund;
}

async function processRefund(refundId, actor, notes) {
  const refund = await prisma.refund.findUnique({
    where: { id: Number(refundId) },
    include: {
      booking: {
        include: {
          customer: {
            select: { id: true, fullName: true, email: true, phone: true }
          }
        }
      }
    }
  });

  if (!refund) {
    throw new Error("Refund not found");
  }

  if (refund.status !== "PENDING") {
    throw new Error("Only pending refunds can be processed");
  }

  const updatedRefund = await prisma.$transaction(async (tx) => {
    const saved = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: "PROCESSED",
        processedBy: actor.id,
        processedAt: new Date(),
        notes: notes || refund.notes
      }
    });

    await tx.booking.update({
      where: { id: refund.bookingId },
      data: {
        refundStatus: "PROCESSED"
      }
    });

    return saved;
  });

  await createAuditLog({
    userId: actor.id,
    action: "REFUND_PROCESSED",
    entityType: "Refund",
    entityId: String(refund.id),
    bookingId: refund.bookingId,
    oldValue: { status: refund.status },
    newValue: { status: "PROCESSED" },
    details: `Refund #${refund.id} processed by ${actor.role}`
  });

  await createNotification(refund.booking.customerId, {
    title: "Refund Processed",
    message: `Your refund of PHP ${toNumber(refund.amount).toFixed(2)} for booking #${refund.bookingId} has been processed.`,
    type: "REFUND",
    actionType: "REFUND_PROCESSED",
    targetId: String(refund.bookingId),
    targetName: `Booking #${refund.bookingId}`,
    enableSms: true
  });

  return updatedRefund;
}

async function listRefunds(status) {
  const where = status ? { status } : {};
  return prisma.refund.findMany({
    where,
    include: {
      booking: {
        include: {
          customer: {
            select: { id: true, fullName: true, email: true, phone: true }
          }
        }
      },
      requester: {
        select: { id: true, fullName: true }
      },
      processor: {
        select: { id: true, fullName: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

module.exports = {
  calculateRefundAmount,
  requestRefund,
  processRefund,
  listRefunds
};

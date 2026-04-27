const prisma = require("../config/prisma");
const { createAuditLog } = require("./audit.service");
const { createNotification, notifyAdmins } = require("./notification.service");
const { runReceiptOcr } = require("./ocr.service");
const {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  getBusinessSettings,
  getRequiredPaymentAmount,
  recomputeBookingState,
  toNumber
} = require("./domain.service");

function normalizeMethod(method) {
  return String(method || "").toUpperCase();
}

function normalizePaymentType(paymentType) {
  return String(paymentType || "").toUpperCase();
}

async function getBookingForPayment(bookingId, actor) {
  const booking = await prisma.booking.findUnique({
    where: { id: Number(bookingId) },
    include: {
      customer: {
        select: { id: true, fullName: true, email: true, phone: true }
      },
      payments: {
        orderBy: { createdAt: "asc" },
        include: { ocrResult: true }
      }
    }
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (actor.role === "CUSTOMER" && String(booking.customerId) !== String(actor.id)) {
    throw new Error("You can only pay for your own booking");
  }

  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new Error("Cancelled bookings cannot accept payments");
  }

  return booking;
}

function computeRequestedAmount(booking, paymentType, requestedAmount, settings) {
  const totalAmount = toNumber(booking.totalAmount);
  const amountPaid = toNumber(booking.amountPaid);
  const remainingBalance = Number((totalAmount - amountPaid).toFixed(2));
  const normalizedType = paymentType || (remainingBalance === totalAmount && totalAmount >= settings.downpaymentThreshold ? "DOWNPAYMENT" : "FULL");

  let amount = requestedAmount ? Number(requestedAmount) : remainingBalance;
  if (normalizedType === "DOWNPAYMENT") {
    amount = getRequiredPaymentAmount(totalAmount, settings);
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  if (amount > remainingBalance) {
    throw new Error(`Payment amount exceeds the remaining balance of ${remainingBalance.toFixed(2)}`);
  }

  return {
    amount: Number(amount.toFixed(2)),
    remainingBalance,
    paymentType: normalizedType
  };
}

async function createPayment(payload, actor) {
  const method = normalizeMethod(payload.method);
  const paymentType = normalizePaymentType(payload.paymentType);
  const booking = await getBookingForPayment(payload.bookingId, actor);
  const settings = await getBusinessSettings();

  if (!["GCASH", "CASH", "GCASH_POST_SERVICE"].includes(method)) {
    throw new Error("Invalid payment method");
  }

  if (actor.role === "CUSTOMER" && method === "CASH") {
    throw new Error("Customers cannot self-record cash payments");
  }

  const { amount, remainingBalance, paymentType: finalPaymentType } = computeRequestedAmount(
    booking,
    paymentType,
    payload.amount,
    settings
  );

  if (remainingBalance <= 0) {
    throw new Error("Booking is already fully paid");
  }

  const requiresReceipt = method !== "CASH";
  if (requiresReceipt && !payload.file) {
    throw new Error("Receipt upload is required for non-cash payments");
  }

  const initialStatus = method === "CASH" ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.FOR_VERIFICATION;
  let createdPayment;
  let statusSnapshot;

  await prisma.$transaction(async (tx) => {
    createdPayment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        method,
        status: initialStatus,
        paymentType: finalPaymentType,
        createdBy: actor.role === "STAFF" ? "STAFF" : "CUSTOMER",
        proofImage: payload.file ? `/uploads/${payload.file.filename}` : null,
        proofOriginalName: payload.file?.originalname || null,
        proofMimeType: payload.file?.mimetype || null,
        proofSizeBytes: payload.file?.size || null,
        referenceNumber: payload.referenceNumber || null,
        expectedAmount: amount,
        verifiedBy: method === "CASH" ? actor.id : null,
        verifiedAt: method === "CASH" ? new Date() : null
      }
    });

    if (payload.file && method !== "CASH") {
      const ocrResult = await runReceiptOcr(payload.file.path, amount);
      await tx.paymentOcrResult.create({
        data: {
          paymentId: createdPayment.id,
          extractedAmount: ocrResult.extractedAmount,
          extractedReferenceNumber: ocrResult.extractedReferenceNumber,
          extractedDate: ocrResult.extractedDate,
          rawText: ocrResult.rawText,
          providerName: ocrResult.providerName,
          providerReference: ocrResult.providerReference,
          confidence: ocrResult.confidence,
          matchStatus: ocrResult.matchStatus,
          mismatchReason: ocrResult.mismatchReason
        }
      });
    }

    statusSnapshot = await recomputeBookingState(tx, booking.id);
  });

  await createAuditLog({
    userId: actor.id,
    action: "PAYMENT_CREATED",
    entityType: "Payment",
    entityId: String(createdPayment.id),
    bookingId: booking.id,
    newValue: {
      amount,
      method,
      status: initialStatus,
      paymentType: finalPaymentType
    },
    details: `${actor.role} created a ${method} payment for booking #${booking.id}`
  });

  await createNotification(booking.customerId, {
    title: initialStatus === PAYMENT_STATUS.PAID ? "Payment Recorded" : "Payment Submitted",
    message: initialStatus === PAYMENT_STATUS.PAID
      ? `A payment of PHP ${amount.toFixed(2)} was recorded for your booking.`
      : `Your payment of PHP ${amount.toFixed(2)} was submitted for verification.`,
    type: "PAYMENT",
    actionType: "PAYMENT_CREATED",
    targetId: String(booking.id),
    targetName: `Booking #${booking.id}`,
    enableSms: true
  });

  if (method === "CASH") {
    await notifyAdmins({
      title: "Cash Payment Recorded",
      message: `Booking #${booking.id} has a cash payment of PHP ${amount.toFixed(2)} recorded by ${actor.role.toLowerCase()}.`,
      type: "PAYMENT",
      actionType: "PAYMENT_RECORDED",
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`,
      enableSms: true
    });
  } else {
    await notifyAdmins({
      title: "Payment Requires Review",
      message: `Booking #${booking.id} has a ${method} payment of PHP ${amount.toFixed(2)} pending review.`,
      type: "PAYMENT",
      actionType: "PAYMENT_FOR_REVIEW",
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`,
      enableSms: true
    });
  }

  return {
    payment: createdPayment,
    booking: statusSnapshot.updatedBooking
  };
}

async function reviewPayment(paymentId, action, actor, rejectionReason) {
  const resolvedAction = String(action || "").toUpperCase();
  if (!["APPROVE", "REJECT", "FAIL", "RESUBMIT"].includes(resolvedAction)) {
    throw new Error("Review action must be APPROVE, REJECT, FAIL, or RESUBMIT");
  }

  const payment = await prisma.payment.findUnique({
    where: { id: Number(paymentId) },
    include: {
      booking: {
        include: {
          customer: {
            select: { id: true, fullName: true }
          }
        }
      },
      ocrResult: true
    }
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (![PAYMENT_STATUS.FOR_VERIFICATION, PAYMENT_STATUS.PENDING].includes(payment.status)) {
    throw new Error("Only pending verification payments can be reviewed");
  }

  const nextStatus = resolvedAction === "APPROVE"
    ? PAYMENT_STATUS.PAID
    : resolvedAction === "REJECT"
      ? PAYMENT_STATUS.REJECTED
      : resolvedAction === "RESUBMIT"
        ? PAYMENT_STATUS.PENDING
        : PAYMENT_STATUS.FAILED;

  let statusSnapshot;
  const updatedPayment = await prisma.$transaction(async (tx) => {
    const savedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        verifiedBy: resolvedAction === "APPROVE" ? actor.id : null,
        verifiedAt: resolvedAction === "APPROVE" ? new Date() : null,
        rejectionReason: resolvedAction === "REJECT" ? rejectionReason || "Rejected by admin review" : null,
        failureReason: resolvedAction === "FAIL" ? rejectionReason || "Payment validation failed" : null
      }
    });

    if (payment.ocrResult) {
      await tx.paymentOcrResult.update({
        where: { paymentId: payment.id },
        data: {
          reviewedBy: actor.id,
          reviewedAt: new Date()
        }
      });
    }

    statusSnapshot = await recomputeBookingState(tx, payment.bookingId);
    return savedPayment;
  });

  await createAuditLog({
    userId: actor.id,
    action: `PAYMENT_${resolvedAction}`,
    entityType: "Payment",
    entityId: String(payment.id),
    bookingId: payment.bookingId,
    oldValue: { status: payment.status },
    newValue: { status: nextStatus },
    details: `Payment #${payment.id} ${resolvedAction.toLowerCase()}d by ${actor.role}${rejectionReason ? `: ${rejectionReason}` : ""}`
  });

  await createNotification(payment.booking.customerId, {
    title: resolvedAction === "APPROVE" ? "Payment Approved" : resolvedAction === "RESUBMIT" ? "Payment Resubmission Needed" : "Payment Review Update",
    message: resolvedAction === "APPROVE"
      ? `Your payment for booking #${payment.bookingId} has been approved.`
      : resolvedAction === "RESUBMIT"
        ? `Your payment for booking #${payment.bookingId} needs a new receipt upload. ${rejectionReason || ""}`.trim()
      : `Your payment for booking #${payment.bookingId} was marked as ${nextStatus}. ${rejectionReason || ""}`.trim(),
    type: "PAYMENT",
    actionType: `PAYMENT_${resolvedAction}`,
    targetId: String(payment.bookingId),
    targetName: `Booking #${payment.bookingId}`,
    enableSms: true
  });

  return {
    payment: updatedPayment,
    booking: statusSnapshot.updatedBooking
  };
}

async function getPayments(filters, actor) {
  const where = {};
  if (filters.bookingId) {
    where.bookingId = Number(filters.bookingId);
  }
  if (filters.status) {
    const normalizedStatus = String(filters.status).toUpperCase();
    if (normalizedStatus === "APPROVED") {
      where.status = { in: ["APPROVED", "PAID"] };
    } else if (normalizedStatus === "PAID") {
      where.status = { in: ["PAID", "APPROVED"] };
    } else {
      where.status = normalizedStatus;
    }
  }
  if (filters.method) {
    where.method = String(filters.method).toUpperCase();
  }
  if (!["ADMIN", "SUPER_ADMIN", "STAFF"].includes(actor.role)) {
    const customerBookings = await prisma.booking.findMany({
      where: { customerId: actor.id },
      select: { id: true }
    });
    where.bookingId = { in: customerBookings.map((booking) => booking.id) };
  }

  return prisma.payment.findMany({
    where,
    include: {
      booking: {
        include: {
          customer: {
            select: { id: true, fullName: true, email: true, phone: true }
          }
        }
      },
      ocrResult: true
    },
    orderBy: { createdAt: "desc" }
  });
}

async function getPaymentDashboard(filters = {}) {
  const dateFilter = {};
  if (filters.from || filters.to) {
    dateFilter.createdAt = {};
    if (filters.from) {
      dateFilter.createdAt.gte = new Date(filters.from);
    }
    if (filters.to) {
      dateFilter.createdAt.lte = new Date(filters.to);
    }
  }

  const payments = await prisma.payment.findMany({
    where: dateFilter,
    include: { booking: true }
  });

  const verifiedPayments = payments.filter((payment) => [PAYMENT_STATUS.PAID, PAYMENT_STATUS.APPROVED].includes(payment.status));
  const revenue = verifiedPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const bookingCounts = await prisma.booking.groupBy({
    by: ["status"],
    _count: { status: true }
  });

  return {
    revenue: Number(revenue.toFixed(2)),
    paymentCount: payments.length,
    bookingCounts
  };
}

module.exports = {
  createPayment,
  reviewPayment,
  getPayments,
  getPaymentDashboard
};

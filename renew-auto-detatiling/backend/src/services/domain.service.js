const prisma = require("../config/prisma");

const BOOKING_STATUS = {
  PENDING: "PENDING",
  SCHEDULED: "SCHEDULED",
  CONFIRMED: "CONFIRMED",
  ONGOING: "ONGOING",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED"
};

const SERVICE_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  ONGOING: "ONGOING",
  COMPLETED: "COMPLETED"
};

const PAYMENT_STATUS = {
  PENDING: "PENDING",
  FOR_VERIFICATION: "FOR_VERIFICATION",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
  APPROVED: "APPROVED",
  VERIFIED: "VERIFIED",
  COMPLETED: "COMPLETED"
};

const VERIFIED_PAYMENT_STATUSES = new Set([
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.PARTIALLY_PAID,
  PAYMENT_STATUS.APPROVED,
  PAYMENT_STATUS.VERIFIED,
  PAYMENT_STATUS.COMPLETED
]);

function toNumber(value) {
  return Number(value || 0);
}

async function getBusinessSettings(tx = prisma) {
  const settings = await tx.businessSettings.findFirst();
  return {
    downpaymentThreshold: toNumber(settings?.downpaymentThreshold || 5000),
    downpaymentPercentage: toNumber(settings?.downpaymentPercentage || 0.5),
    paymentGracePeriodHours: settings?.paymentGracePeriodHours || 24,
    pendingCleanupHours: settings?.pendingCleanupHours || 24,
    startReminderDelayMinutes: settings?.startReminderDelayMinutes || 5,
    notificationRetryLimit: settings?.notificationRetryLimit || 3
  };
}

function getRequiredPaymentAmount(totalAmount, settings) {
  const total = toNumber(totalAmount);
  if (total >= settings.downpaymentThreshold) {
    return Number((total * settings.downpaymentPercentage).toFixed(2));
  }

  return total;
}

function getPaymentProgress(booking, payments, settings) {
  const totalAmount = toNumber(booking.totalAmount);
  const verifiedPayments = payments.filter((payment) => VERIFIED_PAYMENT_STATUSES.has(payment.status));
  const validPaidAmount = verifiedPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const hasPendingVerification = payments.some((payment) => payment.status === PAYMENT_STATUS.FOR_VERIFICATION);
  const hasRejected = payments.some((payment) => payment.status === PAYMENT_STATUS.REJECTED);
  const hasFailed = payments.some((payment) => payment.status === PAYMENT_STATUS.FAILED);
  const minimumToStart = getRequiredPaymentAmount(totalAmount, settings);
  const paymentRequirementMet = validPaidAmount >= minimumToStart;
  const fullyPaid = totalAmount > 0 && validPaidAmount >= totalAmount;

  let aggregateStatus = PAYMENT_STATUS.PENDING;
  if (fullyPaid) {
    aggregateStatus = PAYMENT_STATUS.PAID;
  } else if (hasPendingVerification) {
    aggregateStatus = PAYMENT_STATUS.FOR_VERIFICATION;
  } else if (validPaidAmount > 0) {
    aggregateStatus = PAYMENT_STATUS.PARTIALLY_PAID;
  } else if (hasRejected) {
    aggregateStatus = PAYMENT_STATUS.REJECTED;
  } else if (hasFailed) {
    aggregateStatus = PAYMENT_STATUS.FAILED;
  }

  return {
    totalAmount,
    validPaidAmount: Number(validPaidAmount.toFixed(2)),
    aggregateStatus,
    paymentRequirementMet,
    fullyPaid,
    minimumToStart
  };
}

async function recomputeBookingState(tx, bookingId, options = {}) {
  const booking = await tx.booking.findUnique({
    where: { id: Number(bookingId) },
    include: {
      payments: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  const settings = await getBusinessSettings(tx);
  const paymentProgress = getPaymentProgress(booking, booking.payments, settings);
  const canOverrideCompletion = Boolean(booking.adminOverrideAt) || Boolean(options.adminOverride);
  const nextData = {
    amountPaid: paymentProgress.validPaidAmount,
    paymentStatus: paymentProgress.aggregateStatus
  };

  if (booking.serviceStatus === SERVICE_STATUS.ONGOING) {
    nextData.status = BOOKING_STATUS.ONGOING;
  } else if (booking.serviceStatus === SERVICE_STATUS.COMPLETED) {
    if (paymentProgress.fullyPaid || canOverrideCompletion) {
      nextData.status = BOOKING_STATUS.COMPLETED;
      nextData.isLocked = true;
    } else {
      throw new Error("Cannot complete booking without full payment or admin override");
    }
  } else if (![BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(booking.status)) {
    nextData.status = BOOKING_STATUS.SCHEDULED;
  }

  const updatedBooking = await tx.booking.update({
    where: { id: booking.id },
    data: nextData,
    include: {
      customer: {
        select: { id: true, fullName: true, email: true, phone: true }
      },
      assignedStaff: {
        select: { id: true, fullName: true, email: true, phone: true }
      },
      payments: {
        orderBy: { createdAt: "desc" },
        include: {
          ocrResult: true
        }
      },
      items: true
    }
  });

  return {
    booking,
    updatedBooking,
    paymentProgress,
    settings
  };
}

async function assertBookingCanStart(tx, bookingId) {
  const booking = await tx.booking.findUnique({
    where: { id: Number(bookingId) },
    include: { payments: true }
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new Error("Cancelled bookings cannot be started");
  }

  const settings = await getBusinessSettings(tx);
  const paymentProgress = getPaymentProgress(booking, booking.payments, settings);

  if (!paymentProgress.paymentRequirementMet) {
    throw new Error("Cannot start service without the required verified payment");
  }

  if (!booking.assignedStaffId) {
    throw new Error("Cannot start service without an assigned staff member");
  }

  return { booking, paymentProgress, settings };
}

async function startBookingService(tx, bookingId) {
  await assertBookingCanStart(tx, bookingId);
  return tx.booking.update({
    where: { id: Number(bookingId) },
    data: {
      serviceStatus: SERVICE_STATUS.ONGOING,
      status: BOOKING_STATUS.ONGOING
    }
  });
}

async function completeBookingService(tx, bookingId, override = null) {
  const booking = await tx.booking.findUnique({
    where: { id: Number(bookingId) }
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  const overrideData = override ? {
    adminOverrideAt: new Date(),
    adminOverrideBy: override.adminOverrideBy,
    adminOverrideReason: override.reason
  } : {};

  await tx.booking.update({
    where: { id: Number(bookingId) },
    data: {
      serviceStatus: SERVICE_STATUS.COMPLETED,
      ...overrideData
    }
  });

  return recomputeBookingState(tx, bookingId, {
    adminOverride: Boolean(override)
  });
}

module.exports = {
  BOOKING_STATUS,
  SERVICE_STATUS,
  PAYMENT_STATUS,
  VERIFIED_PAYMENT_STATUSES,
  getBusinessSettings,
  getRequiredPaymentAmount,
  getPaymentProgress,
  recomputeBookingState,
  assertBookingCanStart,
  startBookingService,
  completeBookingService,
  toNumber
};

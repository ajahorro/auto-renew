const prisma = require("../config/prisma");
const auditService = require("./audit.service");
const notificationService = require("./notification.service");

/**
 * Status Engine Service — SINGLE SOURCE OF TRUTH
 * ALL state transitions MUST go through this engine.
 * No controller or job may directly modify status fields.
 */
class StatusEngineService {

  // ===========================================
  // GLOBAL GUARDS
  // ===========================================

  /**
   * Archived booking immutability guard.
   */
  _assertNotArchived(booking) {
    if (booking.archivedAt != null) {
      throw new Error("BOOKING_ARCHIVED_IMMUTABLE: Cannot mutate an archived booking.");
    }
  }

  /**
   * PATCH 2: Refund full system lock.
   * Refunded booking is financially AND operationally terminal.
   * Applied to ALL mutation paths: booking, service, payment.
   */
  _assertNotRefundFinalized(booking) {
    if (booking.refundStatus === "PROCESSED") {
      throw new Error("BOOKING_REFUNDED_LOCKED: Cannot mutate a refund-finalized booking.");
    }
  }

  // ===========================================
  // BOOKING STATUS TRANSITIONS
  // ===========================================

  async transitionBooking(bookingId, nextStatus, userId, metadata = {}) {
    const execute = async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { payments: true }
      });

      if (!booking) throw new Error("Booking not found");

      this._assertNotArchived(booking);
      // PATCH 2: Block ALL booking transitions on refunded bookings
      this._assertNotRefundFinalized(booking);

      const prevStatus = booking.status;
      this._validateBookingTransition(prevStatus, nextStatus);

      // Final Completion Rule
      if (nextStatus === "COMPLETED") {
        if (booking.serviceStatus !== "FINISHED") {
          throw new Error("Cannot complete booking: Service must be FINISHED first.");
        }
        if (booking.paymentStatus !== "PAID" && booking.overrideUsed !== true) {
          throw new Error("Cannot complete booking: Payment must be PAID or overridden by admin.");
        }
      }

      let bookingUpdate = { 
        status: nextStatus,
        updatedAt: new Date(),
        isLocked: nextStatus === "COMPLETED"
      };

      // Handle Cancellation Metadata
      if (nextStatus === "CANCELLED") {
        bookingUpdate.cancelledAt = new Date();
        bookingUpdate.cancelledBy = userId;
        if (metadata.reason) bookingUpdate.cancellationReason = metadata.reason;
        if (metadata.cancellationStatus) bookingUpdate.cancellationStatus = metadata.cancellationStatus;
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: bookingUpdate
      });

      await auditService.logAction(tx, {
        bookingId, userId,
        action: nextStatus === "CANCELLED" ? "APPROVE_CANCEL" : "BOOKING_STATUS_CHANGE",
        entityType: "BOOKING",
        entityId: bookingId.toString(),
        oldValue: { status: prevStatus },
        newValue: { status: nextStatus },
        details: metadata.reason || `Booking status changed from ${prevStatus} to ${nextStatus}`
      });

      await notificationService.createNotification({
        userId: booking.customerId,
        title: nextStatus === "CANCELLED" ? "Booking Cancelled" : "Booking Update",
        message: nextStatus === "CANCELLED" 
          ? `Your booking #${bookingId} has been cancelled.` 
          : `Your booking status has been updated to ${nextStatus}.`,
        type: nextStatus === "CANCELLED" ? "CANCELLATION" : "BOOKING_UPDATE",
        actionType: nextStatus === "CANCELLED" ? "CANCELLATION_APPROVED" : "STATUS_CHANGED",
        relatedId: bookingId.toString()
      });

      return updatedBooking;
    };

    if (metadata.tx) return await execute(metadata.tx);
    return await prisma.$transaction(execute);
  }

  // ===========================================
  // SERVICE STATUS TRANSITIONS
  // ===========================================

  async transitionService(bookingId, nextStatus, userId, metadata = {}) {
    const execute = async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) throw new Error("Booking not found");

      this._assertNotArchived(booking);
      // PATCH 2: Block ALL service transitions on refunded bookings
      this._assertNotRefundFinalized(booking);

      // Block service downgrade after completion
      if (booking.status === "COMPLETED") {
        throw new Error("SERVICE_LOCKED: Cannot change service status after booking is COMPLETED.");
      }

      const prevStatus = booking.serviceStatus;
      this._validateServiceTransition(prevStatus, nextStatus);

      let bookingUpdate = { serviceStatus: nextStatus };
      
      if (nextStatus === "IN_PROGRESS" && booking.status === "CONFIRMED") {
        bookingUpdate.status = "ONGOING";
      }
      if (nextStatus === "NOT_STARTED" && booking.status === "ONGOING") {
        bookingUpdate.status = "CONFIRMED";
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: bookingUpdate
      });

      await auditService.logAction(tx, {
        bookingId, userId,
        action: "SERVICE_STATUS_CHANGE",
        entityType: "BOOKING",
        entityId: bookingId.toString(),
        oldValue: { serviceStatus: prevStatus },
        newValue: { serviceStatus: nextStatus },
        details: `Service status changed from ${prevStatus} to ${nextStatus}`
      });

      return updatedBooking;
    };

    if (metadata.tx) return await execute(metadata.tx);
    return await prisma.$transaction(execute);
  }

  // ===========================================
  // PAYMENT STATUS TRANSITIONS
  // ===========================================

  async transitionPayment(paymentId, nextStatus, userId, metadata = {}) {
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true }
      });

      if (!payment) throw new Error("Payment not found");

      this._assertNotArchived(payment.booking);
      // PATCH 2: Block ALL payment verification on refunded bookings
      this._assertNotRefundFinalized(payment.booking);

      const prevStatus = payment.status;

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: { 
          status: nextStatus,
          verifiedBy: userId,
          verifiedAt: ["PAID", "REJECTED", "FAILED"].includes(nextStatus) ? new Date() : null,
          rejectionReason: metadata.reason || null
        }
      });

      await this._syncBookingPaymentStatus(tx, payment.bookingId);

      await auditService.logAction(tx, {
        bookingId: payment.bookingId,
        userId,
        action: "PAYMENT_STATUS_CHANGE",
        entityType: "PAYMENT",
        entityId: paymentId.toString(),
        oldValue: { status: prevStatus },
        newValue: { status: nextStatus },
        details: `Payment status changed from ${prevStatus} to ${nextStatus}`
      });

      return updatedPayment;
    });
  }

  // ===========================================
  // VALIDATION
  // ===========================================

  _validateBookingTransition(from, to) {
    const validTransitions = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["ONGOING", "CANCELLED"],
      ONGOING: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: []
    };
    if (!validTransitions[from]?.includes(to)) {
      throw new Error(`Invalid booking status transition from ${from} to ${to}`);
    }
  }

  _validateServiceTransition(from, to) {
    const validTransitions = {
      NOT_STARTED: ["IN_PROGRESS"],
      IN_PROGRESS: ["FINISHED", "NOT_STARTED"],
      FINISHED: []
    };
    if (!validTransitions[from]?.includes(to)) {
      throw new Error(`Invalid service status transition from ${from} to ${to}`);
    }
  }

  // ===========================================
  // PAYMENT STATUS DERIVATION
  // ===========================================

  async _syncBookingPaymentStatus(tx, bookingId) {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true }
    });

    const payments = booking.payments;
    const totalAmount = Number(booking.totalAmount);
    const nextStatus = this._derivePaymentStatus(payments, totalAmount);

    const VERIFIED_STATUSES = ["PAID", "APPROVED", "VERIFIED", "COMPLETED"];
    const verifiedSum = payments
      .filter(p => VERIFIED_STATUSES.includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    await tx.booking.update({
      where: { id: bookingId },
      data: { 
        paymentStatus: nextStatus,
        amountPaid: verifiedSum
      }
    });
  }

  /**
   * Deterministic payment status derivation.
   * 
   * Priority:
   * 1. No payments → UNPAID
   * 2. verifiedSum >= required → PAID (terminal)
   * 3. Any FOR_VERIFICATION → FOR_VERIFICATION
   * 4. PATCH 4: All payments REJECTED/FAILED → UNPAID
   * 5. verifiedSum == 0 → UNPAID
   * 6. verifiedSum < required → PARTIALLY_PAID
   */
  _derivePaymentStatus(payments, requiredAmount) {
    if (!payments || payments.length === 0) {
      return "UNPAID";
    }

    const VERIFIED_STATUSES = ["PAID", "APPROVED", "VERIFIED", "COMPLETED"];
    const verifiedSum = payments
      .filter(p => VERIFIED_STATUSES.includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // PAID is terminal — once fully paid, cannot be downgraded
    if (verifiedSum >= requiredAmount && requiredAmount > 0) {
      return "PAID";
    }

    // FOR_VERIFICATION only applies if not fully paid
    if (payments.some(p => p.status === "FOR_VERIFICATION")) {
      return "FOR_VERIFICATION";
    }

    // PATCH 4: If ALL payments are REJECTED or FAILED, return UNPAID explicitly
    const allTerminalFailed = payments.every(p => 
      p.status === "REJECTED" || p.status === "FAILED"
    );
    if (allTerminalFailed) {
      return "UNPAID";
    }

    if (verifiedSum === 0) {
      return "UNPAID";
    }

    return "PARTIALLY_PAID";
  }
}

module.exports = new StatusEngineService();

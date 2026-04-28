const prisma = require("../config/prisma");
const statusEngine = require("./statusEngine.service");
const auditService = require("./audit.service");

/**
 * Payment Service
 * Handles payment processing, business rules, and aggregation.
 * PATCH 4: Refund finalization lock
 * PATCH 6: Cash overpayment detection
 * PATCH 8: Explicit payment-after-completion rule
 */
class PaymentService {
  /**
   * Create a new payment record
   */
  async createPayment(bookingId, paymentData, userId) {
    const { amount, method, paymentType, proofImage, referenceNumber, createdBy } = paymentData;

    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { payments: true }
      });

      if (!booking) throw new Error("Booking not found");

      // PATCH 3: Archived guard
      if (booking.archivedAt != null) {
        throw new Error("BOOKING_ARCHIVED_IMMUTABLE: Cannot add payment to an archived booking.");
      }

      // PATCH 2: Refund full system lock — no new payments after refund
      if (booking.refundStatus === "PROCESSED") {
        throw new Error("BOOKING_REFUNDED_LOCKED: Cannot add payment to a refund-finalized booking.");
      }

      // PATCH 5: Track post-completion payment classification
      const isPostCompletion = booking.status === "COMPLETED";

      // PATCH 8: Payment after completion — ALLOWED for both override and non-override
      // Payments update PaymentStatus normally but do NOT change booking status.
      // This is explicitly defined behavior.

      // Business Rule: Threshold for Downpayment
      const settings = await tx.businessSettings.findFirst() || { downpaymentThreshold: 5000 };
      const totalAmount = Number(booking.totalAmount);
      
      if (totalAmount >= Number(settings.downpaymentThreshold)) {
        // Allows downpayment
      } else if (paymentType === "DOWNPAYMENT") {
        throw new Error("Downpayment not allowed for bookings below ₱" + settings.downpaymentThreshold);
      }

      // PATCH 6: Overpayment detection
      const isCash = method === "CASH";
      const paymentStatus = isCash ? "PAID" : "FOR_VERIFICATION";

      const currentVerifiedSum = booking.payments
        .filter(p => p.status === "PAID")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const projectedSum = currentVerifiedSum + (isCash ? Number(amount) : 0);
      const isExcessPayment = projectedSum > totalAmount;
      const excessAmount = isExcessPayment ? projectedSum - totalAmount : 0;

      // Create Payment
      const payment = await tx.payment.create({
        data: {
          bookingId,
          amount,
          method,
          paymentType,
          status: paymentStatus,
          proofImage,
          referenceNumber,
          createdBy: createdBy || "CUSTOMER",
          ...(isCash && userId ? {
            verifiedBy: String(userId),
            verifiedAt: new Date()
          } : {})
        }
      });

      // Sync PaymentStatus (always recalculate after mutation — PATCH 9)
      await statusEngine._syncBookingPaymentStatus(tx, bookingId);

      // Audit: Standard payment log
      const auditAction = isCash ? "CASH_PAYMENT_RECORDED" : "PAYMENT_CREATED";
      await auditService.logAction(tx, {
        bookingId,
        userId,
        action: auditAction,
        entityType: "PAYMENT",
        entityId: payment.id.toString(),
        newValue: { 
          amount, method, status: payment.status,
          ...(isCash ? { isManual: true, recordedBy: userId, recordedAt: new Date().toISOString() } : {}),
          ...(isExcessPayment ? { excessPayment: true, excessAmount } : {}),
          // PATCH 5: Post-completion payment classification
          ...(isPostCompletion ? { isPostCompletion: true } : {})
        },
        details: isCash 
          ? `Staff recorded cash payment of ₱${amount} (manual entry).${isPostCompletion ? ' [POST-COMPLETION]' : ''}`
          : `New ${paymentType} payment of ₱${amount} via ${method} created.${isPostCompletion ? ' [POST-COMPLETION]' : ''}`
      });

      // PATCH 6: Extra audit log for overpayment
      if (isExcessPayment) {
        await auditService.logAction(tx, {
          bookingId,
          userId,
          action: "EXCESS_PAYMENT_DETECTED",
          entityType: "PAYMENT",
          entityId: payment.id.toString(),
          newValue: { 
            paymentAmount: Number(amount),
            totalRequired: totalAmount,
            previousVerifiedSum: currentVerifiedSum,
            projectedSum,
            excessAmount
          },
          details: `Excess payment detected: ₱${excessAmount.toFixed(2)} over required amount.`
        });
      }

      return payment;
    });
  }

  /**
   * Aggregation Engine: Recalculate total paid for a booking
   */
  async getPaymentSummary(bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true }
    });

    if (!booking) throw new Error("Booking not found");

    const verifiedPayments = booking.payments.filter(p => p.status === "PAID");
    const totalPaid = verifiedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Number(booking.totalAmount) - totalPaid;

    return {
      totalAmount: Number(booking.totalAmount),
      totalPaid,
      balance,
      isFullyPaid: balance <= 0,
      payments: booking.payments
    };
  }

  /**
   * Reconciliation
   */
  async reconcileBooking(bookingId) {
    return await prisma.$transaction(async (tx) => {
      await statusEngine._syncBookingPaymentStatus(tx, bookingId);
      const summary = await this.getPaymentSummary(bookingId);
      return summary;
    });
  }
}

module.exports = new PaymentService();

const prisma = require("../config/prisma");
const auditService = require("./audit.service");

/**
 * Refund Service
 * Handles refund evaluation and processing logic.
 */
class RefundService {
  /**
   * Evaluate potential refund for a booking
   */
  async evaluateRefund(bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true }
    });

    if (!booking) throw new Error("Booking not found");

    // Rule: Refund only applies to verified (PAID) payments
    const verifiedPayments = booking.payments.filter(p => p.status === "PAID");
    const totalRefundable = verifiedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      bookingId,
      totalPaid: Number(booking.amountPaid),
      totalRefundable,
      message: totalRefundable > 0 ? "Refund is possible." : "No verified payments found for refund."
    };
  }

  /**
   * Process a refund (Admin only)
   */
  async processRefund(bookingId, amount, reason, adminId) {
    return await prisma.$transaction(async (tx) => {
      const evaluation = await this.evaluateRefund(bookingId);
      
      if (amount > evaluation.totalRefundable) {
        throw new Error(`Refund amount (₱${amount}) exceeds refundable total (₱${evaluation.totalRefundable})`);
      }

      // Create Refund Record
      const refund = await tx.refund.create({
        data: {
          bookingId,
          amount,
          reason,
          status: "PROCESSED",
          processedById: adminId,
          processedAt: new Date()
        }
      });

      // Update Booking
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          refundAmount: { increment: amount },
          // Note: paymentStatus might change to REFUNDED if fully refunded
          paymentStatus: amount >= evaluation.totalPaid ? "REFUNDED" : undefined
        }
      });

      // Audit Log
      await auditService.logAction(tx, {
        bookingId,
        userId: adminId,
        action: "REFUND_PROCESSED",
        entityType: "REFUND",
        entityId: refund.id,
        newValue: { amount, status: "PROCESSED" },
        details: `Refund of ₱${amount} processed by Admin.`
      });

      return refund;
    });
  }
}

module.exports = new RefundService();

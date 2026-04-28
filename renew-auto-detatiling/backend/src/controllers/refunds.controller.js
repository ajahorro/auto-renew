const prisma = require("../config/prisma");

/**
 * Pure deterministic calculation function.
 * Uses ONLY data passed as arguments — no live queries, no external state.
 * Same function used in GET (optimistic preview) and PROCESS (locked truth).
 */
const calculateFromSnapshot = ({ booking, payments }) => {
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  let incurredCost = Number(booking.incurredCost) || 0;
  if (booking.equipmentDeployed) {
    incurredCost = Number(booking.equipmentCost) || incurredCost;
  }
  const refundAmount = Math.max(totalPaid - incurredCost, 0);
  return { totalPaid, incurredCost, refundAmount: Number(refundAmount.toFixed(2)) };
};

/**
 * Maps booking + calculation to flat DTO.
 * All fields explicitly || null — never undefined.
 * Handles both ORM objects (GET) and raw SQL objects (PROCESS).
 */
const toRefundDTO = (booking, calc) => ({
  bookingId: booking.id || booking.bookingId,
  customerFullName: booking.customerFullName || booking.customer?.fullName || null,
  customerEmail: booking.customerEmail || booking.customer?.email || null,
  cancellationReason: booking.cancellationReason || null,
  cancelledAt: booking.cancelledAt || null,
  refundStatus: booking.refundStatus || null,
  totalPaid: calc.totalPaid,
  incurredCost: calc.incurredCost,
  refundAmount: calc.refundAmount
});

// ===== GET PENDING (optimistic preview — unlocked) =====
// Uses same calculateFromSnapshot as PROCESS but without row locks.
// Amounts are estimates — final processed amount may differ.
const GET_PENDING_REFUNDS = async (req, res) => {
  try {
    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Only admins can view pending refunds" });
    }
    const bookings = await prisma.booking.findMany({
      where: { refundStatus: "PENDING" },
      include: { customer: { select: { id: true, fullName: true, email: true, phone: true } } },
      orderBy: { updatedAt: "desc" }
    });

    const bookingIds = bookings.map(b => b.id);
    const allPayments = await prisma.payment.findMany({
      where: { bookingId: { in: bookingIds }, status: "PAID" }
    });

    let pendingTotal = 0;
    const refunds = [];
    for (const booking of bookings) {
      const payments = allPayments.filter(p => p.bookingId === booking.id);
      const calc = calculateFromSnapshot({ booking, payments });
      refunds.push(toRefundDTO(booking, calc));
      pendingTotal += calc.refundAmount;
    }
    res.json({ success: true, refunds, pendingCount: refunds.length, pendingTotal, isEstimated: true });
  } catch (error) {
    console.error("GET PENDING REFUNDS ERROR:", error);
    res.status(500).json({ success: false, code: "SYSTEM_ERROR", message: "Failed to fetch pending refunds" });
  }
};

// ===== GET HISTORY =====
const GET_REFUND_HISTORY = async (req, res) => {
  try {
    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Only admins can view refund history" });
    }
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = { refundStatus: { in: ["PENDING", "PROCESSED"] } };
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where, include: { customer: { select: { id: true, fullName: true, email: true } } },
        orderBy: { updatedAt: "desc" }, skip, take: Number(limit)
      }),
      prisma.booking.count({ where })
    ]);

    const bookingIds = bookings.map(b => b.id);
    const allPayments = await prisma.payment.findMany({
      where: { bookingId: { in: bookingIds }, status: "PAID" }
    });

    const refunds = [];
    for (const booking of bookings) {
      const payments = allPayments.filter(p => p.bookingId === booking.id);
      refunds.push(toRefundDTO(booking, calculateFromSnapshot({ booking, payments })));
    }
    res.json({
      success: true, refunds,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
    });
  } catch (error) {
    console.error("GET REFUND HISTORY ERROR:", error);
    res.status(500).json({ success: false, code: "SYSTEM_ERROR", message: "Failed to fetch refund history" });
  }
};

// ===== PROCESS REFUND (locked, serialized, atomic) =====
// Transaction order: LOCK → READ → VALIDATE → COMPUTE → CREATE → UPDATE → AUDIT → OUTBOX
const PROCESS_REFUND = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.id;

    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Only admins can process refunds" });
    }
    if (!bookingId) {
      return res.status(400).json({ success: false, code: "MISSING_BOOKING_ID", message: "Booking ID is required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. LOCK + READ booking in single raw query (no ORM/raw split)
      const [lockedBooking] = await tx.$queryRaw`
        SELECT b.*, u."fullName" AS "customerFullName", u."email" AS "customerEmail"
        FROM "Booking" b
        LEFT JOIN "User" u ON b."customerId" = u."id"
        WHERE b."id" = ${Number(bookingId)}
        FOR UPDATE OF b
      `;
      if (!lockedBooking) throw { httpStatus: 404, code: "BOOKING_NOT_FOUND", message: "Booking not found" };

      // 2. VALIDATE (under lock — deterministic)
      if (lockedBooking.refundStatus !== "PENDING") throw { httpStatus: 409, code: "REFUND_ALREADY_PROCESSED", message: "Refund already processed" };

      // 3. LOCK + READ payments
      // NOTE: Payment lock semantics are scope-limited to this transaction, not system-wide.
      // Payments are operationally stable during refund lifecycle because cancelled bookings
      // do not accept new payments (enforced by booking controller, not DB constraint).
      const payments = await tx.$queryRaw`
        SELECT * FROM "Payment"
        WHERE "bookingId" = ${Number(bookingId)} AND "status"::text = 'PAID'
        FOR UPDATE
      `;

      // 4. COMPUTE from locked read set
      const calc = calculateFromSnapshot({ booking: lockedBooking, payments });
      if (calc.refundAmount <= 0) throw { httpStatus: 400, code: "INVALID_REFUND_AMOUNT", message: "No verified payments found to refund." };

      const actor = await tx.user.findUnique({ where: { id: userId } });

      // 5. CREATE REFUND (immutable financial snapshot — @unique prevents duplicates)
      await tx.refund.create({
        data: {
          bookingId: Number(bookingId), amount: calc.refundAmount,
          totalPaid: calc.totalPaid, incurredCost: calc.incurredCost,
          status: "PROCESSED", reason: lockedBooking.cancellationReason || "Admin-approved refund",
          processedById: userId, processedAt: new Date()
        }
      });

      // 6. UPDATE BOOKING
      await tx.booking.update({ where: { id: Number(bookingId) }, data: { refundStatus: "PROCESSED" } });

      // 7. AUDIT LOG
      await tx.auditLog.create({
        data: {
          userId, action: "PROCESS_REFUND", entityType: "Booking", entityId: String(bookingId),
          oldValue: JSON.stringify({ refundStatus: "PENDING" }),
          newValue: JSON.stringify({ refundStatus: "PROCESSED", refundAmount: calc.refundAmount }),
          bookingId: Number(bookingId), performedBy: userId
        }
      });

      // 8. OUTBOX ONLY — worker handles email + in-app notification creation
      await tx.notificationQueue.create({
        data: {
          userId: lockedBooking.customerId, title: "Refund Processed",
          message: `Your refund of ₱${calc.refundAmount.toLocaleString()} for Booking #${lockedBooking.id} has been processed.`,
          type: "REFUND", channels: ["EMAIL"],
          metadata: {
            bookingId: lockedBooking.id, refundAmount: calc.refundAmount,
            actorName: actor?.fullName || "Admin",
            actionType: "REFUND_PROCESSED", actorId: userId,
            targetId: String(lockedBooking.id), targetName: `Booking #${lockedBooking.id}`
          },
          idempotencyKey: `REFUND:${lockedBooking.id}:PROCESSED`
        }
      });

      return {
        bookingId: lockedBooking.id, customerFullName: lockedBooking.customerFullName || null,
        customerEmail: lockedBooking.customerEmail || null, cancellationReason: lockedBooking.cancellationReason || null,
        cancelledAt: lockedBooking.cancelledAt || null, refundStatus: "PROCESSED",
        totalPaid: calc.totalPaid, incurredCost: calc.incurredCost, refundAmount: calc.refundAmount
      };
    });

    res.json({ success: true, refund: result });
  } catch (error) {
    if (error.httpStatus) return res.status(error.httpStatus).json({ success: false, code: error.code, message: error.message });

    // P2002 = unique constraint violation — prior transaction already committed successfully.
    // Return idempotent success with existing refund data.
    if (error?.code === "P2002") {
      const data = await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: Number(req.body.bookingId) },
          include: { customer: { select: { fullName: true, email: true } } }
        });
        const refund = await tx.refund.findUnique({ where: { bookingId: Number(req.body.bookingId) } });
        if (!booking || !refund) throw new Error("Inconsistent refund state");
        return { booking, refund };
      });
      return res.json({
        success: true, idempotent: true,
        refund: {
          bookingId: Number(req.body.bookingId),
          customerFullName: data.booking.customer?.fullName || null,
          customerEmail: data.booking.customer?.email || null,
          cancellationReason: data.booking.cancellationReason || null,
          cancelledAt: data.booking.cancelledAt || null, refundStatus: "PROCESSED",
          totalPaid: Number(data.refund.totalPaid ?? 0),
          incurredCost: Number(data.refund.incurredCost ?? 0),
          refundAmount: Number(data.refund.amount ?? 0)
        }
      });
    }

    console.error("PROCESS REFUND ERROR:", error);
    res.status(500).json({ success: false, code: "SYSTEM_ERROR", message: error.message || "Failed to process refund" });
  }
};

// ===== GET CALCULATION =====
const GET_REFUND_CALCULATION = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) return res.status(400).json({ success: false, code: "MISSING_BOOKING_ID", message: "Booking ID is required" });
    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: { customer: { select: { id: true, fullName: true } }, payments: { where: { status: "PAID" } } }
    });
    if (!booking) return res.status(404).json({ success: false, code: "BOOKING_NOT_FOUND", message: "Booking not found" });
    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role) && booking.customerId !== req.user.id) {
      return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Unauthorized" });
    }
    const calc = calculateFromSnapshot({ booking, payments: booking.payments });
    res.json({ success: true, ...toRefundDTO(booking, calc) });
  } catch (error) {
    console.error("GET REFUND CALCULATION ERROR:", error);
    res.status(500).json({ success: false, code: "SYSTEM_ERROR", message: "Failed to calculate refund" });
  }
};

module.exports = { GET_PENDING_REFUNDS, PROCESS_REFUND, GET_REFUND_HISTORY, GET_REFUND_CALCULATION };

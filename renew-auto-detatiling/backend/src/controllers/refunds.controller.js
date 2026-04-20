const prisma = require("../config/prisma");




const calculateRefundAmount = async (bookingId) => {
  const payments = await prisma.payment.findMany({
    where: { bookingId, status: "APPROVED" }
  });
  
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  
  let incurredCost = Number(booking.incurredCost) || 0;
  if (booking.equipmentDeployed) {
    incurredCost = Number(booking.equipmentCost) || incurredCost;
  }
  
  const refundAmount = Math.max(totalPaid - incurredCost, 0);
  
  return {
    totalPaid,
    incurredCost,
    refundAmount: Number(refundAmount.toFixed(2))
  };
};

const GET_PENDING_REFUNDS = async (req, res) => {
  try {
    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can view pending refunds"
      });
    }

    const bookings = await prisma.booking.findMany({
      where: { refundStatus: "PENDING" },
      include: {
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        cancellationRequests: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        payments: {
          where: { status: "APPROVED" }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    const refunds = await Promise.all(
      bookings.map(async (booking) => {
        const calculation = await calculateRefundAmount(booking.id);
        return {
          bookingId: booking.id,
          customer: booking.customer,
          cancellationReason: booking.cancellationReason,
          cancelledAt: booking.cancelledAt,
          calculation,
          cancellationRequest: booking.cancellationRequests[0] || null
        };
      })
    );

    res.json({
      success: true,
      refunds
    });

  } catch (error) {
    console.error("GET PENDING REFUNDS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending refunds"
    });
  }
};

const PROCESS_REFUND = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.id;

    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can process refunds"
      });
    }

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: { customer: true }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (booking.refundStatus !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "This booking does not have a pending refund"
      });
    }

    if (Number(booking.refundAmount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "No refund amount to process"
      });
    }

    const calculation = await calculateRefundAmount(booking.id);
    const actor = await prisma.user.findUnique({ where: { id: userId } });

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: Number(bookingId) },
        data: {
          refundStatus: "PROCESSED"
        }
      });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Refund Processed",
          message: `Your refund of ₱${calculation.refundAmount.toLocaleString()} for Booking #${booking.id} has been processed.`,
          type: "REFUND",
          actionType: "REFUND_PROCESSED",
          actorId: userId,
          actorName: actor?.fullName || "Admin",
          targetId: String(booking.id),
          targetName: `Booking #${booking.id}`
        }
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "PROCESS_REFUND",
          entityType: "Booking",
          entityId: String(bookingId),
          oldValue: JSON.stringify({ refundStatus: "PENDING" }),
          newValue: JSON.stringify({ refundStatus: "PROCESSED", refundAmount: calculation.refundAmount })
        }
      });
    });

    res.json({
      success: true,
      message: "Refund processed successfully",
      refund: {
        bookingId: booking.id,
        customerId: booking.customerId,
        totalPaid: calculation.totalPaid,
        incurredCost: calculation.incurredCost,
        refundAmount: calculation.refundAmount
      }
    });

  } catch (error) {
    console.error("PROCESS REFUND ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process refund"
    });
  }
};

const GET_REFUND_HISTORY = async (req, res) => {
  try {
    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can view refund history"
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { refundStatus: { in: ["PENDING", "PROCESSED"] } };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          cancellationRequests: {
            where: { status: "APPROVED" },
            orderBy: { createdAt: "desc" },
            take: 1
          }
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: Number(limit)
      }),
      prisma.booking.count({ where })
    ]);

    const refunds = await Promise.all(
      bookings.map(async (booking) => {
        const calculation = await calculateRefundAmount(booking.id);
        return {
          bookingId: booking.id,
          customer: booking.customer,
          cancellationReason: booking.cancellationReason,
          cancelledAt: booking.cancelledAt,
          refundStatus: booking.refundStatus,
          calculation,
          cancellationRequest: booking.cancellationRequests[0] || null
        };
      })
    );

    res.json({
      success: true,
      refunds,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error("GET REFUND HISTORY ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch refund history"
    });
  }
};

const GET_REFUND_CALCULATION = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: {
        customer: { select: { id: true, fullName: true } },
        payments: { where: { status: "APPROVED" } }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role) && 
        booking.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const calculation = await calculateRefundAmount(booking.id);

    res.json({
      success: true,
      bookingId: booking.id,
      customer: booking.customer,
      equipmentDeployed: booking.equipmentDeployed,
      equipmentCost: Number(booking.equipmentCost),
      incurredCost: calculation.incurredCost,
      payments: booking.payments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        createdAt: p.createdAt
      })),
      calculation
    });

  } catch (error) {
    console.error("GET REFUND CALCULATION ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate refund"
    });
  }
};

module.exports = {
  GET_PENDING_REFUNDS,
  PROCESS_REFUND,
  GET_REFUND_HISTORY,
  GET_REFUND_CALCULATION
};

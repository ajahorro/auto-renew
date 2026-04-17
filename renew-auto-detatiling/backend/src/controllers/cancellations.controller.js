const prisma = require("../config/prisma");
const { sendEmail } = require("../services/email.service");

const LOG_REQUEST = (req, context) => {
  console.log(`[${context}] Request Body:`, JSON.stringify(req.body, null, 2));
  console.log(`[${context}] Request Params:`, JSON.stringify(req.params, null, 2));
  console.log(`[${context}] Request Query:`, JSON.stringify(req.query, null, 2));
};

const createNotification = async (userId, data) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, notifyEmail: true, notifyWeb: true }
    });

    if (!user) return null;

    const hasWeb = user.notifyWeb !== false;
    const hasEmail = user.notifyEmail !== false;

    if (!hasWeb && !hasEmail) return null;

    const inAppNotification = hasWeb ? await prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type || "GENERAL",
        actionType: data.actionType,
        actorId: data.actorId,
        actorName: data.actorName,
        targetId: data.targetId,
        targetName: data.targetName
      }
    }) : null;

    if (hasEmail && user.email) {
      const emailHtml = `<div style="font-family: Arial; max-width: 600px;"><h2 style="color: #1e40af;">${data.title}</h2><p>${data.message}</p></div>`;
      sendEmail(user.email, `[RENEW] ${data.title}`, emailHtml).catch(() => {});
    }

    return inAppNotification;
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

const notifyAdmins = async (data) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    for (const admin of admins) {
      await createNotification(admin.id, data);
    }
  } catch (error) {
    console.error("Failed to notify admins:", error);
  }
};

const calculateRefund = async (bookingId) => {
  const payments = await prisma.payment.findMany({
    where: { bookingId, status: "APPROVED" }
  });
  
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  
  let incurredCost = 0;
  if (booking && booking.equipmentDeployed) {
    incurredCost = Number(booking.equipmentCost) || 0;
  }
  
  const refundAmount = Math.max(totalPaid - incurredCost, 0);
  
  return { totalPaid, incurredCost, refundAmount };
};

const REQUEST_CANCELLATION = async (req, res) => {
  try {
    LOG_REQUEST(req, "REQUEST_CANCELLATION");
    
    const { bookingId, reason } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required"
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

    if (booking.cancellationStatus === "REQUESTED") {
      return res.status(400).json({
        success: false,
        message: "Cancellation already requested for this booking"
      });
    }

    if (booking.cancellationStatus === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "This booking has already been cancelled"
      });
    }

    if (!["PENDING", "CONFIRMED", "ONGOING"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot request cancellation for this booking status"
      });
    }

    const actor = await prisma.user.findUnique({ where: { id: userId } });

    await prisma.$transaction(async (tx) => {
      await tx.cancellationRequest.create({
        data: {
          bookingId: booking.id,
          requestedBy: userId,
          reason: reason.trim(),
          status: "REQUESTED"
        }
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          cancellationStatus: "REQUESTED"
        }
      });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Cancellation Requested",
          message: `Your cancellation request for Booking #${booking.id} has been submitted. We will review it shortly.`,
          type: "CANCELLATION",
          actionType: "CANCELLATION_REQUESTED",
          actorId: userId,
          actorName: actor?.fullName || "Customer",
          targetId: String(booking.id),
          targetName: `Booking #${booking.id}`
        }
      });

      await notifyAdmins({
        title: "New Cancellation Request",
        message: `${actor?.fullName || "Customer"} requested cancellation for Booking #${booking.id}. Reason: ${reason}`,
        type: "CANCELLATION",
        actionType: "CANCELLATION_REQUESTED",
        actorId: userId,
        actorName: actor?.fullName || "Customer",
        targetId: String(booking.id),
        targetName: `Booking #${booking.id}`
      });
    });

    res.status(201).json({
      success: true,
      message: "Cancellation request submitted successfully"
    });

  } catch (error) {
    console.error("ERROR [REQUEST_CANCELLATION]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const APPROVE_CANCELLATION = async (req, res) => {
  try {
    LOG_REQUEST(req, "APPROVE_CANCELLATION");
    
    const { id } = req.params;
    const { adminNote } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can approve cancellation requests"
      });
    }

    const cancellationRequest = await prisma.cancellationRequest.findUnique({
      where: { id: Number(id) },
      include: { 
        booking: { include: { customer: true } },
        requester: true
      }
    });

    if (!cancellationRequest) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }

    if (cancellationRequest.status !== "REQUESTED") {
      return res.status(400).json({
        success: false,
        message: "This cancellation request has already been processed"
      });
    }

    const { totalPaid, incurredCost, refundAmount } = await calculateRefund(cancellationRequest.bookingId);
    const actor = await prisma.user.findUnique({ where: { id: userId } });

    await prisma.$transaction(async (tx) => {
      await tx.cancellationRequest.update({
        where: { id: Number(id) },
        data: {
          status: "APPROVED",
          reviewedBy: userId,
          reviewedAt: new Date(),
          adminNote: adminNote || null
        }
      });

      await tx.booking.update({
        where: { id: cancellationRequest.bookingId },
        data: {
          status: "CANCELLED",
          cancellationStatus: "APPROVED",
          cancellationReason: cancellationRequest.reason,
          cancelledAt: new Date(),
          cancelledBy: userId,
          refundAmount,
          refundStatus: refundAmount > 0 ? "PENDING" : "NONE"
        }
      });

      await tx.notification.create({
        data: {
          userId: cancellationRequest.requester.id,
          title: "Cancellation Approved",
          message: refundAmount > 0 
            ? `Your cancellation request for Booking #${cancellationRequest.bookingId} has been approved. Refund of ₱${refundAmount.toLocaleString()} will be processed.`
            : `Your cancellation request for Booking #${cancellationRequest.bookingId} has been approved.`,
          type: "CANCELLATION",
          actionType: "CANCELLATION_APPROVED",
          actorId: userId,
          actorName: actor?.fullName || "Admin",
          targetId: String(cancellationRequest.bookingId),
          targetName: `Booking #${cancellationRequest.bookingId}`
        }
      });
    });

    res.json({
      success: true,
      message: "Cancellation request approved",
      refundAmount
    });

  } catch (error) {
    console.error("ERROR [APPROVE_CANCELLATION]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const REJECT_CANCELLATION = async (req, res) => {
  try {
    LOG_REQUEST(req, "REJECT_CANCELLATION");
    
    const { id } = req.params;
    const { adminNote } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can reject cancellation requests"
      });
    }

    const cancellationRequest = await prisma.cancellationRequest.findUnique({
      where: { id: Number(id) },
      include: { 
        booking: { include: { customer: true } },
        requester: true
      }
    });

    if (!cancellationRequest) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }

    if (cancellationRequest.status !== "REQUESTED") {
      return res.status(400).json({
        success: false,
        message: "This cancellation request has already been processed"
      });
    }

    const actor = await prisma.user.findUnique({ where: { id: userId } });

    await prisma.$transaction(async (tx) => {
      await tx.cancellationRequest.update({
        where: { id: Number(id) },
        data: {
          status: "REJECTED",
          reviewedBy: userId,
          reviewedAt: new Date(),
          adminNote: adminNote || null
        }
      });

      await tx.booking.update({
        where: { id: cancellationRequest.bookingId },
        data: {
          cancellationStatus: "REJECTED"
        }
      });

      await tx.notification.create({
        data: {
          userId: cancellationRequest.requester.id,
          title: "Cancellation Rejected",
          message: `Your cancellation request for Booking #${cancellationRequest.bookingId} has been rejected.${adminNote ? ` Note: ${adminNote}` : ""}`,
          type: "CANCELLATION",
          actionType: "CANCELLATION_REJECTED",
          actorId: userId,
          actorName: actor?.fullName || "Admin",
          targetId: String(cancellationRequest.bookingId),
          targetName: `Booking #${cancellationRequest.bookingId}`
        }
      });
    });

    res.json({
      success: true,
      message: "Cancellation request rejected"
    });

  } catch (error) {
    console.error("ERROR [REJECT_CANCELLATION]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const GET_CANCELLATION_REQUESTS = async (req, res) => {
  try {
    LOG_REQUEST(req, "GET_CANCELLATION_REQUESTS");
    
    const { bookingId, status } = req.query;

    const where = {};
    if (bookingId) where.bookingId = Number(bookingId);
    if (status) where.status = status;

    const requests = await prisma.cancellationRequest.findMany({
      where,
      include: {
        booking: {
          include: {
            customer: { select: { id: true, fullName: true, email: true } }
          }
        },
        requester: { select: { id: true, fullName: true } },
        reviewedByUser: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      success: true,
      requests: requests || []
    });

  } catch (error) {
    console.error("ERROR [GET_CANCELLATION_REQUESTS]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const GET_CANCELLATION_BY_ID = async (req, res) => {
  try {
    LOG_REQUEST(req, "GET_CANCELLATION_BY_ID");
    
    const { id } = req.params;

    const request = await prisma.cancellationRequest.findUnique({
      where: { id: Number(id) },
      include: {
        booking: {
          include: {
            customer: { select: { id: true, fullName: true, email: true, phone: true } },
            payments: true,
            items: { include: { service: true } }
          }
        },
        requester: { select: { id: true, fullName: true } },
        reviewedByUser: { select: { id: true, fullName: true } }
      }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }

    res.json({
      success: true,
      request
    });

  } catch (error) {
    console.error("ERROR [GET_CANCELLATION_BY_ID]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

module.exports = {
  REQUEST_CANCELLATION,
  APPROVE_CANCELLATION,
  REJECT_CANCELLATION,
  GET_CANCELLATION_REQUESTS,
  GET_CANCELLATION_BY_ID
};

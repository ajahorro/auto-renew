const prisma = require("../config/prisma");
const path = require("path");
const fs = require("fs");

/* ============================
   HELPER: Create audit log
   ============================ */
const createAuditLog = async (userId, action, entityType, entityId, oldValue, newValue) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId: String(entityId),
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null
      }
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
};

/* ============================
    HELPER: Notify admins
    ============================ */
const notifyAdmins = async (data) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    for (const admin of admins) {
      await createNotification(admin.id, data);
    }
  } catch (error) {
    console.error("Notify admins error:", error);
  }
};

/* ============================
    HELPER: Notify user
    ============================ */
const createNotification = async (userId, data) => {
  try {
    await prisma.notification.create({
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
    });
  } catch (error) {
    console.error("Notification error:", error);
  }
};

/* ============================
   CREATE PAYMENT (CUSTOMER)
   ============================ */
const createPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    const { bookingId, method } = req.body;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID required" });
    }

    // Validate booking
    const booking = await prisma.booking.findFirst({
      where: {
        id: Number(bookingId),
        customerId: userId
      },
      include: { items: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Check booking status
    if (!["pending_payment", "partially_paid"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot add payment. Booking status: ${booking.status}`
      });
    }

    // Calculate remaining balance
    const remainingBalance = Number(booking.totalAmount) - Number(booking.amountPaid);
    
    if (remainingBalance <= 0) {
      return res.status(400).json({
        success: false,
        message: "Booking is already fully paid"
      });
    }

    // Handle file upload if GCash
    let receiptImage = null;
    if (method === "GCASH" && req.file) {
      receiptImage = `/uploads/${req.file.filename}`;
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: remainingBalance, // Default to remaining balance
        method: method || "CASH",
        status: method === "GCASH" ? "pending" : "verified", // CASH is auto-verified
        receiptImage
      }
    });

    // For CASH payments, immediately update booking
    if (method === "CASH" || method === "MANUAL") {
      await updateBookingPaymentStatus(booking.id, remainingBalance);
    }

    // Notify admins about the payment
    await notifyAdmins({
      title: method === "GCASH" ? "Payment Submitted" : "Cash Payment Received",
      message: `Booking #${booking.id}: ₱${Number(payment.amount).toLocaleString()} via ${method}. ${method === "GCASH" ? "Awaiting verification." : "Auto-verified."}`,
      type: "PAYMENT",
      actionType: method === "GCASH" ? "PAYMENT_PENDING" : "PAYMENT_RECEIVED",
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`
    });

    res.status(201).json({
      success: true,
      message: method === "GCASH" 
        ? "Payment submitted. Awaiting admin verification."
        : "Payment recorded successfully.",
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status,
        receiptImage: payment.receiptImage
      }
    });

  } catch (error) {
    console.error("CREATE PAYMENT ERROR:", error);
    next(error);
  }
};

/* ============================
   UPDATE BOOKING PAYMENT STATUS
   ============================ */
const updateBookingPaymentStatus = async (bookingId, newPaymentAmount) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) return;

    const newAmountPaid = Number(booking.amountPaid) + Number(newPaymentAmount);
    const totalAmount = Number(booking.totalAmount);
    const downpaymentAmount = Number(booking.downpaymentAmount) || 0;

    let newStatus = booking.status;
    let paymentStatus = "pending";

    if (newAmountPaid >= totalAmount) {
      newStatus = "confirmed";
      paymentStatus = "completed";
    } else if (newAmountPaid >= downpaymentAmount && downpaymentAmount > 0) {
      newStatus = "partially_paid";
      paymentStatus = "pending";
    } else {
      paymentStatus = "pending";
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
        paymentStatus
      }
    });

    // Notify customer
    await createNotification(booking.customerId, {
      title: newStatus === "confirmed" ? "Booking Confirmed" : "Payment Received",
      message: newStatus === "confirmed"
        ? "Your booking is now fully paid and confirmed."
        : `Payment of ₱${newPaymentAmount.toLocaleString()} received. Remaining: ₱${(totalAmount - newAmountPaid).toLocaleString()}`,
      type: "PAYMENT",
      targetId: String(bookingId)
    });

  } catch (error) {
    console.error("Update booking payment status error:", error);
  }
};

/* ============================
   VERIFY PAYMENT (ADMIN)
   ============================ */
const verifyPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    const paymentId = Number(req.params.id);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    if (!paymentId) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    const { verified, rejectionReason, extractedAmount, extractedDate } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been processed"
      });
    }

    // Update payment
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: verified ? "verified" : "rejected",
        verifiedBy: verified ? userId : null,
        verifiedAt: verified ? new Date() : null,
        rejectionReason: rejectionReason || null,
        ...(extractedAmount !== undefined && { extractedAmount }),
        ...(extractedDate && { extractedDate })
      }
    });

    // Create audit log
    await createAuditLog(
      userId,
      verified ? "VERIFY" : "REJECT",
      "Payment",
      paymentId,
      { status: payment.status },
      { status: verified ? "verified" : "rejected", amount: payment.amount }
    );

    if (verified) {
      // Update booking payment
      await updateBookingPaymentStatus(payment.bookingId, payment.amount);

      // Notify customer
      await createNotification(payment.booking.customerId, {
        title: "Payment Verified",
        message: `Your ₱${Number(payment.amount).toLocaleString()} payment has been verified.`,
        type: "PAYMENT",
        targetId: String(payment.bookingId)
      });

      // Notify admins
      await notifyAdmins({
        title: "Payment Verified",
        message: `Payment of ₱${Number(payment.amount).toLocaleString()} for Booking #${payment.bookingId} has been verified.`,
        type: "PAYMENT",
        actionType: "PAYMENT_VERIFIED",
        targetId: String(payment.bookingId),
        targetName: `Booking #${payment.bookingId}`
      });
    } else {
      // Notify customer of rejection
      await createNotification(payment.booking.customerId, {
        title: "Payment Rejected",
        message: rejectionReason || "Your payment was rejected. Please upload a new payment receipt.",
        type: "PAYMENT",
        targetId: String(payment.bookingId)
      });

      // Notify admins
      await notifyAdmins({
        title: "Payment Rejected",
        message: `Payment for Booking #${payment.bookingId} has been rejected. ${rejectionReason || ""}`,
        type: "PAYMENT",
        actionType: "PAYMENT_REJECTED",
        targetId: String(payment.bookingId),
        targetName: `Booking #${payment.bookingId}`
      });
    }

    res.json({
      success: true,
      message: verified ? "Payment verified successfully" : "Payment rejected",
      payment: updatedPayment
    });

  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);
    next(error);
  }
};

/* ============================
   CREATE MANUAL PAYMENT (RU - ADMIN)
   ============================ */
const createManualPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    const { bookingId, amount, note } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and amount required"
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Check not overpaying
    const remainingBalance = Number(booking.totalAmount) - Number(booking.amountPaid);
    if (Number(amount) > remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds remaining balance of ₱${remainingBalance.toLocaleString()}`
      });
    }

    // Create manual payment
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: Number(amount),
        method: "MANUAL",
        status: "verified",
        verifiedBy: userId,
        verifiedAt: new Date(),
        manualNote: note || "RU payment - verified manually"
      }
    });

    // Create audit log
    await createAuditLog(
      userId,
      "CREATE",
      "Payment",
      payment.id,
      null,
      { method: "MANUAL", amount: Number(amount) }
    );

    // Update booking
    await updateBookingPaymentStatus(booking.id, amount);

    res.status(201).json({
      success: true,
      message: "Manual payment recorded successfully",
      payment
    });

  } catch (error) {
    console.error("CREATE MANUAL PAYMENT ERROR:", error);
    next(error);
  }
};

/* ============================
   GET PAYMENTS
   ============================ */
const getPayments = async (req, res, next) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    const userRole = req.user?.role || "CUSTOMER";

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    const { bookingId, status, method, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};

    // Filter by booking
    if (bookingId) {
      where.bookingId = Number(bookingId);
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by method
    if (method) {
      where.method = method;
    }

    // Non-admin users only see their own bookings' payments
    if (!["ADMIN", "SUPER_ADMIN"].includes(userRole.toUpperCase())) {
      where.booking = { customerId: userId };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              customerId: true,
              totalAmount: true,
              amountPaid: true,
              customer: {
                select: { id: true, fullName: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit)
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      success: true,
      payments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error("GET PAYMENTS ERROR:", error);
    next(error);
  }
};

/* ============================
   GET PENDING VERIFICATIONS (ADMIN)
   ============================ */
const getPendingVerifications = async (req, res, next) => {
  try {
    const { method, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { status: "pending" };
    if (method) {
      where.method = method;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          booking: {
            include: {
              customer: {
                select: { id: true, fullName: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: Number(limit)
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      success: true,
      payments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error("GET PENDING VERIFICATIONS ERROR:", error);
    next(error);
  }
};

/* ============================
   BULK VERIFY PAYMENTS (ADMIN)
   ============================ */
const bulkVerifyPayments = async (req, res, next) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    const { paymentIds, verified } = req.body;

    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Payment IDs array required"
      });
    }

    // Get pending payments
    const payments = await prisma.payment.findMany({
      where: {
        id: { in: paymentIds.map(Number) },
        status: "pending"
      },
      include: { booking: true }
    });

    if (payments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending payments found"
      });
    }

    // Update all payments
    await prisma.payment.updateMany({
      where: { id: { in: payments.map(p => p.id) } },
      data: {
        status: verified ? "verified" : "rejected",
        verifiedBy: verified ? userId : null,
        verifiedAt: verified ? new Date() : null
      }
    });

    // Update booking statuses for verified payments
    if (verified) {
      for (const payment of payments) {
        await updateBookingPaymentStatus(payment.bookingId, payment.amount);
        
        await createNotification(payment.booking.customerId, {
          title: "Payment Verified",
          message: `Your ₱${Number(payment.amount).toLocaleString()} payment has been verified.`,
          type: "PAYMENT",
          targetId: String(payment.bookingId)
        });
      }
    }

    // Create audit log
    await createAuditLog(
      userId,
      "BULK_VERIFY",
      "Payment",
      paymentIds.join(","),
      { count: payments.length, verified },
      { verified }
    );

    res.json({
      success: true,
      message: `${payments.length} payments ${verified ? "verified" : "rejected"}`,
      count: payments.length
    });

  } catch (error) {
    console.error("BULK VERIFY ERROR:", error);
    next(error);
  }
};

/* ============================
   OCR RECEIPT (Basic implementation)
   Note: In production, use Tesseract.js or external OCR service
   ============================ */
const processOcrReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // This is a basic OCR implementation
    // In production, use Tesseract.js or a proper OCR service
    
    // For now, return placeholder extracted data
    // The admin will verify the actual values
    
    const result = {
      success: true,
      message: "Receipt uploaded. Please verify extracted data manually.",
      extractedData: {
        referenceNumber: null, // Admin should verify
        amount: null,
        date: null,
        rawText: "OCR processing requires additional setup. Please verify manually."
      }
    };

    res.json(result);

  } catch (error) {
    console.error("OCR ERROR:", error);
    next(error);
  }
};

module.exports = {
  createPayment,
  verifyPayment,
  createManualPayment,
  getPayments,
  getPendingVerifications,
  bulkVerifyPayments,
  processOcrReceipt
};

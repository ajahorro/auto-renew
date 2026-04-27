const prisma = require("../config/prisma");
const { createAuditLog } = require("../services/audit.service");
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

    if (hasWeb) {
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
    }

    if (hasEmail && user.email) {
      const emailHtml = `<div style="font-family: Arial; max-width: 600px;"><h2 style="color: #1e40af;">${data.title}</h2><p>${data.message}</p></div>`;
      sendEmail(user.email, `[RENEW] ${data.title}`, emailHtml).catch(() => {});
    }
  } catch (error) {
    console.error("Notification error:", error);
  }
};

const notifyAdmins = async (data) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    await Promise.all(
      admins.map((admin) => createNotification(admin.id, data))
    );
  } catch (error) {
    console.error("Notify admins error:", error);
  }
};

const createPayment = async (req, res) => {
  try {
    LOG_REQUEST(req, "CREATE_PAYMENT");
    
    const userId = req.user?.id ? String(req.user.id) : null;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    const { bookingId, method, paymentType } = req.body;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID required" });
    }

    const validMethods = ["GCASH", "CASH", "GCASH_POST_SERVICE"];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ 
        success: false, 
        message: `Payment method must be one of: ${validMethods.join(", ")}` 
      });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: Number(bookingId),
        customerId: userId
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const isPostServicePayment = method === "GCASH_POST_SERVICE" || booking.status === "COMPLETED";
    
    if (!["PENDING", "CONFIRMED", "COMPLETED"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot add payment. Booking status: ${booking.status}`
      });
    }

    if (isPostServicePayment && method !== "GCASH" && method !== "GCASH_POST_SERVICE") {
      return res.status(400).json({
        success: false,
        message: "Post-service payments can only be made via GCash"
      });
    }

    const remainingBalance = Number(booking.totalAmount) - Number(booking.amountPaid);
    
    if (remainingBalance <= 0 && method !== "GCASH_POST_SERVICE") {
      return res.status(400).json({
        success: false,
        message: "Booking is already fully paid"
      });
    }

    let proofImage = null;
    const requiresProof = method === "GCASH" || method === "GCASH_POST_SERVICE";
    
    if (requiresProof) {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "GCash receipt/proof image is required"
        });
      }
      proofImage = `/uploads/${req.file.filename}`;
    }

    const isPostService = method === "GCASH_POST_SERVICE" || (booking.status === "COMPLETED" && requiresProof);
    // GCash payments always go to FOR_VERIFICATION (admin must approve)
    const status = (method === "GCASH" || method === "GCASH_POST_SERVICE") ? "FOR_VERIFICATION" : "PAID";
    const type = paymentType || (Number(booking.totalAmount) >= 5000 && Number(booking.amountPaid) === 0 ? "DOWNPAYMENT" : "FULL");
    const amount = type === "DOWNPAYMENT" 
      ? Number(booking.totalAmount) * 0.5 
      : remainingBalance;

    const finalMethod = isPostService ? "GCASH_POST_SERVICE" : method;

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        method: finalMethod,
        status,
        paymentType: type,
        createdBy: "CUSTOMER",
        proofImage
      }
    });

    // For GCash: update booking paymentStatus to FOR_VERIFICATION
    if (method === "GCASH" || method === "GCASH_POST_SERVICE") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: "FOR_VERIFICATION" }
      });
    }

    // Cash is auto-approved
    if (method === "CASH" && !isPostService) {
      await updateBookingPaymentStatus(booking.id, amount);
    }

    if (isPostService) {
      await prisma.notification.create({
        data: {
          userId: booking.customerId,
          title: "Post-Service Payment Submitted",
          message: `Your post-service GCash payment of ₱${Number(payment.amount).toLocaleString()} has been submitted. Awaiting admin verification.`,
          type: "PAYMENT",
          actionType: "PAYMENT_PENDING"
        }
      });
    }

    await notifyAdmins({
      title: isPostService ? "Post-Service Payment Submitted" : (method === "GCASH" ? "Payment Submitted" : "Cash Payment Received"),
      message: `Booking #${booking.id}: ₱${Number(payment.amount).toLocaleString()} via ${finalMethod}. ${isPostService ? "Post-service payment. Awaiting verification." : (method === "GCASH" ? "Awaiting verification." : "Auto-verified.")}`,
      type: "PAYMENT",
      actionType: isPostService ? "POST_SERVICE_PAYMENT" : (method === "GCASH" ? "PAYMENT_PENDING" : "PAYMENT_RECEIVED"),
      targetId: String(booking.id),
      targetName: `Booking #${booking.id}`
    });

    // Audit log - fire and forget so it doesn't block the response
    createAuditLog({
      userId,
      action: "CREATE",
      entityType: "Payment",
      entityId: String(payment.id),
      newValue: { amount: Number(payment.amount), method: finalMethod, status, type },
      details: `Customer submitted ${finalMethod} payment of ₱${Number(payment.amount).toLocaleString()} for Booking #${booking.id}`,
      bookingId: booking.id,
      performedBy: userId
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: isPostService 
        ? "Post-service payment submitted. Awaiting admin verification."
        : (method === "GCASH" ? "Payment submitted. Awaiting admin verification." : "Payment recorded successfully."),
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status,
        proofImage: payment.proofImage
      }
    });

  } catch (error) {
    console.error("ERROR [CREATE_PAYMENT]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const updateBookingPaymentStatus = async (bookingId, newPaymentAmount) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) return;

    const newAmountPaid = Number(booking.amountPaid) + Number(newPaymentAmount);
    const totalAmount = Number(booking.totalAmount);

    // Determine new PAYMENT status (NEVER changes booking.status)
    let newPaymentStatus;
    if (newAmountPaid >= totalAmount && totalAmount > 0) {
      newPaymentStatus = "PAID";
    } else {
      newPaymentStatus = "UNPAID";
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: newPaymentStatus
        // booking.status is intentionally NOT touched here
      }
    });

    await createNotification(booking.customerId, {
      title: newPaymentStatus === "PAID" ? "Payment Complete" : "Payment Partially Received",
      message: newPaymentStatus === "PAID"
        ? "Your booking is now fully paid."
        : `Payment of ₱${Number(newPaymentAmount).toLocaleString()} received. Remaining balance: ₱${(totalAmount - newAmountPaid).toLocaleString()}.`,
      type: "PAYMENT",
      targetId: String(bookingId)
    });

  } catch (error) {
    console.error("Update booking payment status error:", error);
  }
};

const verifyPayment = async (req, res) => {
  try {
    LOG_REQUEST(req, "VERIFY_PAYMENT");
    
    const userId = req.user?.id ? String(req.user.id) : null;
    const paymentId = Number(req.params.id);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    if (!paymentId) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admins can verify payments" });
    }

    // action: "approve" | "reject" | "resubmit"
    const { action, rejectionReason } = req.body;
    // backward compat: if old "approved" bool is sent
    const resolvedAction = action || (req.body.approved === true ? "approve" : req.body.approved === false ? "reject" : null);

    if (!resolvedAction || !["approve", "reject", "resubmit"].includes(resolvedAction)) {
      return res.status(400).json({ success: false, message: "action must be one of: approve, reject, resubmit" });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    if (!["FOR_VERIFICATION", "PENDING"].includes(payment.status)) {
      return res.status(400).json({
        success: false,
        message: "Payment has already been processed"
      });
    }

    let updatedPaymentStatus;
    let bookingPaymentStatusUpdate = {};

    if (resolvedAction === "approve") {
      updatedPaymentStatus = "PAID";
    } else if (resolvedAction === "reject") {
      updatedPaymentStatus = "UNPAID";
      bookingPaymentStatusUpdate = { paymentStatus: "UNPAID" };
    } else {
      // resubmit — send back to customer
      updatedPaymentStatus = "UNPAID";
      bookingPaymentStatusUpdate = { paymentStatus: "UNPAID" };
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: updatedPaymentStatus,
        verifiedBy: resolvedAction === "approve" ? userId : null,
        verifiedAt: resolvedAction === "approve" ? new Date() : null,
        rejectionReason: rejectionReason || null
      }
    });

    // If approved, update amountPaid + paymentStatus on booking
    if (resolvedAction === "approve") {
      await updateBookingPaymentStatus(payment.bookingId, payment.amount);
    } else if (Object.keys(bookingPaymentStatusUpdate).length > 0) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: bookingPaymentStatusUpdate
      });
    }

    await createAuditLog({
      userId,
      action: resolvedAction === "approve" ? "PAYMENT_APPROVED" : resolvedAction === "reject" ? "PAYMENT_REJECTED" : "PAYMENT_RESUBMISSION_REQUESTED",
      entityType: "Payment",
      entityId: String(paymentId),
      oldValue: { status: payment.status },
      newValue: { status: updatedPaymentStatus, amount: Number(payment.amount) },
      details: `Admin ${resolvedAction}d payment of ₱${Number(payment.amount).toLocaleString()} for Booking #${payment.bookingId}${rejectionReason ? `. Reason: ${rejectionReason}` : ""}`,
      bookingId: payment.bookingId,
      performedBy: userId
    });

    const customerMsg = {
      approve: { title: "Payment Approved", message: `Your ₱${Number(payment.amount).toLocaleString()} payment has been approved.`, actionType: "PAYMENT_APPROVED" },
      reject: { title: "Payment Rejected", message: rejectionReason || "Your payment was rejected. Please upload a new receipt.", actionType: "PAYMENT_REJECTED" },
      resubmit: { title: "Payment Resubmission Required", message: "Your payment receipt needs to be resubmitted. Please upload a new receipt.", actionType: "PAYMENT_RESUBMIT" }
    }[resolvedAction];

    await createNotification(payment.booking.customerId, {
      ...customerMsg,
      type: "PAYMENT",
      targetId: String(payment.bookingId)
    });

    res.json({
      success: true,
      message: `Payment ${resolvedAction}d successfully`,
      payment: updatedPayment
    });

  } catch (error) {
    console.error("ERROR [VERIFY_PAYMENT]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const createManualPayment = async (req, res) => {
  try {
    LOG_REQUEST(req, "CREATE_MANUAL_PAYMENT");

    const userId = req.user?.id ? String(req.user.id) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    const { bookingId, amount } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({ success: false, message: "Booking ID and amount required" });
    }

    const booking = await prisma.booking.findUnique({ where: { id: Number(bookingId) } });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const remainingBalance = Number(booking.totalAmount) - Number(booking.amountPaid);
    if (Number(amount) > remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds remaining balance of ₱${remainingBalance.toLocaleString()}`
      });
    }

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: Number(amount),
        method: "CASH",
        status: "PAID",
        verifiedBy: userId,
        verifiedAt: new Date()
      }
    });

    await createAuditLog({
      userId,
      action: "CREATE",
      entityType: "Payment",
      entityId: String(payment.id),
      newValue: { method: "MANUAL_CASH", amount: Number(amount) },
      details: `Admin recorded manual cash payment of ₱${Number(amount).toLocaleString()} for Booking #${booking.id}`,
      bookingId: booking.id,
      performedBy: userId
    });

    await updateBookingPaymentStatus(booking.id, amount);

    res.status(201).json({
      success: true,
      message: "Manual payment recorded successfully",
      payment
    });

  } catch (error) {
    console.error("ERROR [CREATE_MANUAL_PAYMENT]:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

const getPayments = async (req, res) => {
  try {
    LOG_REQUEST(req, "GET_PAYMENTS");
    
    const userId = req.user?.id ? String(req.user.id) : null;
    const userRole = req.user?.role || "CUSTOMER";

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    const { bookingId, status, method, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(userRole).toUpperCase());

    let payments = [];
    let total = 0;

    try {
      if (isAdmin) {
        const where = {};
        if (bookingId) where.bookingId = Number(bookingId);
        if (status) where.status = String(status).toUpperCase();
        if (method) where.method = String(method).toUpperCase();

        [payments, total] = await Promise.all([
          prisma.payment.findMany({
            where,
            include: {
              booking: {
                include: {
                  customer: { select: { id: true, fullName: true, email: true } }
                }
              }
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: Number(limit)
          }),
          prisma.payment.count({ where })
        ]);
      } else {
        const bookings = await prisma.booking.findMany({
          where: { customerId: userId },
          select: { id: true }
        });
        const bookingIds = bookings.map(b => b.id);

        const where = { bookingId: { in: bookingIds } };
        if (status) where.status = String(status).toUpperCase();
        if (method) where.method = String(method).toUpperCase();

        [payments, total] = await Promise.all([
          prisma.payment.findMany({
            where,
            include: {
              booking: {
                include: {
                  customer: { select: { id: true, fullName: true, email: true } }
                }
              }
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: Number(limit)
          }),
          prisma.payment.count({ where })
        ]);
      }
    } catch (dbErr) {
      console.error("Payment query error:", dbErr);
      payments = [];
      total = 0;
    }

    res.json({
      success: true,
      payments: payments || [],
      pagination: {
        total: total || 0,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil((total || 0) / Number(limit)) || 0
      }
    });

  } catch (error) {
    console.error("ERROR [GET_PAYMENTS]:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

const getPendingVerifications = async (req, res) => {
  try {
    LOG_REQUEST(req, "GET_PENDING_VERIFICATIONS");
    
    const { method, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { status: "FOR_VERIFICATION" };
    if (method) {
      where.method = String(method).toUpperCase();
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
      }).catch(err => {
        console.error("Payment query error:", err);
        return [];
      }),
      prisma.payment.count({ where }).catch(err => {
        console.error("Payment count error:", err);
        return 0;
      })
    ]);

    res.json({
      success: true,
      payments: payments || [],
      pagination: {
        total: total || 0,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil((total || 0) / Number(limit)) || 0
      }
    });

  } catch (error) {
    console.error("ERROR [GET_PENDING_VERIFICATIONS]:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending payments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

const bulkVerifyPayments = async (req, res) => {
  try {
    LOG_REQUEST(req, "BULK_VERIFY_PAYMENTS");
    
    const userId = req.user?.id ? String(req.user.id) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token" });
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admins can bulk verify payments" });
    }

    const { paymentIds, approved } = req.body;

    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Payment IDs array required"
      });
    }

    const payments = await prisma.payment.findMany({
      where: {
        id: { in: paymentIds.map(Number) },
        status: "PENDING"
      },
      include: { booking: true }
    });

    if (payments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending payments found"
      });
    }

    await prisma.payment.updateMany({
      where: { id: { in: payments.map(p => p.id) } },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        verifiedBy: approved ? userId : null,
        verifiedAt: approved ? new Date() : null
      }
    });

    if (approved) {
      for (const payment of payments) {
        await updateBookingPaymentStatus(payment.bookingId, payment.amount);
        
        await createNotification(payment.booking.customerId, {
          title: "Payment Approved",
          message: `Your ₱${Number(payment.amount).toLocaleString()} payment has been approved.`,
          type: "PAYMENT",
          actionType: "PAYMENT_APPROVED",
          targetId: String(payment.bookingId)
        });
      }
    }

    await createAuditLog({
      userId,
      action: "BULK_VERIFY",
      entityType: "Payment",
      entityId: paymentIds.join(","),
      newValue: { count: payments.length, approved },
      details: `Admin bulk ${approved ? "approved" : "rejected"} ${payments.length} payments`,
      performedBy: userId
    });

    res.json({
      success: true,
      message: `${payments.length} payments ${approved ? "approved" : "rejected"}`,
      count: payments.length
    });

  } catch (error) {
    console.error("ERROR [BULK_VERIFY_PAYMENTS]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const processOcrReceipt = async (req, res) => {
  try {
    LOG_REQUEST(req, "OCR_RECEIPT");
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const result = {
      success: true,
      message: "Receipt uploaded. Please verify extracted data manually.",
      extractedData: {
        referenceNumber: null,
        amount: null,
        date: null,
        rawText: "OCR processing requires additional setup. Please verify manually."
      }
    };

    res.json(result);

  } catch (error) {
    console.error("ERROR [OCR_RECEIPT]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
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

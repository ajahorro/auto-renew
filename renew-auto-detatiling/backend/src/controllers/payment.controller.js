const prisma = require("../config/prisma");
const paymentService = require("../services/payment.service");
const statusEngine = require("../services/statusEngine.service");
const ocrService = require("../services/ocr.service");
const auditService = require("../services/audit.service");
const notificationQueue = require("../services/notificationQueue.service");

const LOG_REQUEST = (req, context) => {
  console.log(`[${context}] Request Body:`, JSON.stringify(req.body, null, 2));
  console.log(`[${context}] Request Params:`, JSON.stringify(req.params, null, 2));
  console.log(`[${context}] Request Query:`, JSON.stringify(req.query, null, 2));
};

const isPrivilegedRole = (role) => {
  const r = String(role || "").toUpperCase();
  return r === "ADMIN" || r === "SUPER_ADMIN";
};

const createPayment = async (req, res) => {
  try {
    LOG_REQUEST(req, "CREATE_PAYMENT");
    const userId = req.user?.id;
    const { bookingId, amount, method, paymentType, referenceNumber } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    let proofImage = null;
    if (req.file) {
      proofImage = `/uploads/${req.file.filename}`;
    }

    const payment = await paymentService.createPayment(Number(bookingId), {
      amount: Number(amount),
      method,
      paymentType,
      proofImage,
      referenceNumber
    }, userId);

    // Optional: Trigger OCR if GCash
    if (method === "GCASH" && proofImage) {
      const ocrData = await ocrService.processReceipt(payment.id, proofImage);
      await ocrService.validateOcrMatch(payment.id, ocrData);
    }

    res.status(201).json({
      success: true,
      message: payment.status === "FOR_VERIFICATION" 
        ? "Payment submitted for verification." 
        : "Payment recorded successfully.",
      payment
    });
  } catch (error) {
    console.error("CREATE_PAYMENT ERROR:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    LOG_REQUEST(req, "VERIFY_PAYMENT");
    const paymentId = Number(req.params.id);
    const { action, rejectionReason } = req.body;

    if (!isPrivilegedRole(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const status = action === "approve" ? "PAID" : "REJECTED";
    const updatedPayment = await statusEngine.transitionPayment(paymentId, status, req.user.id, { reason: rejectionReason });

    res.json({ success: true, payment: updatedPayment });
  } catch (error) {
    console.error("VERIFY_PAYMENT ERROR:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const createManualPayment = async (req, res) => {
  try {
    LOG_REQUEST(req, "CREATE_MANUAL_PAYMENT");
    const userId = req.user?.id;
    const { bookingId, amount } = req.body;

    if (!isPrivilegedRole(req.user.role) && req.user.role !== "STAFF") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const payment = await paymentService.createPayment(Number(bookingId), {
      amount: Number(amount),
      method: "CASH",
      paymentType: "FULL", // Default for manual
      createdBy: "STAFF"
    }, userId);

    res.status(201).json({
      success: true,
      message: "Manual payment recorded successfully",
      payment
    });
  } catch (error) {
    console.error("CREATE_MANUAL_PAYMENT ERROR:", error);
    res.status(400).json({ success: false, message: error.message });
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
    const userId = req.user?.id;
    const { paymentIds, approved } = req.body;

    if (!isPrivilegedRole(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({ success: false, message: "Payment IDs array required" });
    }

    const status = approved ? "PAID" : "REJECTED";
    const results = [];

    for (const id of paymentIds) {
      try {
        const updated = await statusEngine.transitionPayment(Number(id), status, userId);
        results.push(updated);
      } catch (err) {
        console.error(`Failed to verify payment ${id}:`, err.message);
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} payments.`,
      count: results.length
    });
  } catch (error) {
    console.error("BULK_VERIFY_PAYMENTS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
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

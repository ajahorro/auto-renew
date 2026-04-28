const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");

const {
  getAdminBookings,
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
  requestCustomerCancel,
  assignStaff,
  updateBookingStatus,
  updateServiceStatus,
  recordPayment,
  requestDownpayment,
  addServiceToBooking,
  getDailySchedule,
  createAddonRequest,
  getAddonRequests,
  approveAddonRequest,
  rejectAddonRequest,
  addPayment,
  getAvailability,
  getAdminAnalytics,
  updateBooking,
  confirmDownpayment,
  requestCancelBooking,
  processCancellationRequest,
  adminOverride
} = require("../controllers/bookings.controller");

/* ================= GET ROUTES (ADMIN & UTILITY) ================= */

// Group specific static-like routes at the top to avoid parameter collisions
router.get("/admin", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getAdminBookings);
router.get("/admin-analytics", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getAdminAnalytics);
router.get("/schedule", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getDailySchedule);
router.get("/availability", getAvailability);
router.get("/addons", authenticate, authorize("ADMIN", "SUPER_ADMIN", "STAFF"), getAddonRequests);

/* PER-BOOKING AUDIT LOGS - Must be before /:id */
router.get("/:id/audit-logs", authenticate, authorize("ADMIN", "SUPER_ADMIN", "STAFF"), async (req, res) => {
  const prisma = require("../config/prisma");
  try {
    const bookingId = parseInt(req.params.id, 10);
    if (isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    // Staff security check
    if (req.user.role === "STAFF") {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { assignedStaffId: true }
      });
      if (!booking || booking.assignedStaffId !== req.user.id) {
        return res.status(403).json({ success: false, message: "Unauthorized. You are not assigned to this booking." });
      }
    }

    const logs = await prisma.auditLog.findMany({
      where: { bookingId },
      include: {
        performer: {
          select: { id: true, fullName: true, role: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    res.json({ success: true, logs });
  } catch (error) {
    console.error("GET BOOKING AUDIT LOGS ERROR:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
});

/* GET BOOKINGS (CUSTOMER/DEFAULT) */
router.get("/", authenticate, getBookings);

/* ================= POST / PATCH ROUTES (MUTATIONS) ================= */

// Create new booking
router.post("/", authenticate, createBooking);

// Update booking (General)
router.patch("/:id", authenticate, updateBooking);
router.patch("/update/:id", authenticate, updateBooking); // Alias

// Status updates
router.patch("/:id/status", authenticate, updateBookingStatus);
router.patch("/status/:id", authenticate, updateBookingStatus); // Alias

// Payment operations
router.patch("/:id/payment", authenticate, authorize("ADMIN", "SUPER_ADMIN", "STAFF"), recordPayment);
router.patch("/payment/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN", "STAFF"), recordPayment); // Alias
router.post("/:id/add-payment", authenticate, authorize("ADMIN", "SUPER_ADMIN"), addPayment);
router.post("/:id/request-downpayment", authenticate, authorize("ADMIN", "SUPER_ADMIN"), requestDownpayment);
router.post("/:id/confirm-downpayment", authenticate, authorize("ADMIN", "SUPER_ADMIN"), confirmDownpayment);

// Staff & Service management
router.patch("/assign/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), assignStaff);
router.post("/:id/assign-staff", authenticate, authorize("ADMIN", "SUPER_ADMIN"), assignStaff);
router.post("/:id/service-status", authenticate, updateServiceStatus);

// Cancellation flows
router.patch("/cancel/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), cancelBooking);
router.post("/:id/cancel-request", authenticate, authorize("CUSTOMER"), requestCustomerCancel);
router.patch("/:id/cancel-request", authenticate, authorize("ADMIN", "SUPER_ADMIN"), processCancellationRequest);
router.post("/:id/request-cancel", authenticate, authorize("ADMIN", "SUPER_ADMIN"), requestCancelBooking);
router.patch("/:id/cancel", authenticate, authorize("ADMIN", "SUPER_ADMIN"), cancelBooking); // Direct admin cancel
router.post("/:id/admin-override", authenticate, authorize("ADMIN", "SUPER_ADMIN"), adminOverride);

// Addon requests
router.post("/:id/addon", authenticate, authorize("ADMIN", "SUPER_ADMIN", "STAFF", "CUSTOMER"), createAddonRequest);
router.patch("/addon/:requestId/approve", authenticate, authorize("ADMIN", "SUPER_ADMIN"), approveAddonRequest);
router.patch("/addon/:requestId/reject", authenticate, authorize("ADMIN", "SUPER_ADMIN"), rejectAddonRequest);

/* ================= CATCH-ALL ROUTES ================= */

// Get single booking by ID (Must be last GET)
router.get("/:id", authenticate, getBookingById);

module.exports = router;

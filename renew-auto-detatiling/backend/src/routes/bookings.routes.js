const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");

const {
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
  requestCustomerCancel,
  assignStaff,
  updateBookingStatus,
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
  requestCancelBooking
} = require("../controllers/bookings.controller");

/* CREATE BOOKING */
router.post("/", authenticate, createBooking);

/* AVAILABILITY - must be before /:id */
router.get("/availability", getAvailability);

/* GET BOOKINGS */
router.get("/", authenticate, getBookings);

/* UPDATE BOOKING (CUSTOMER) */
router.patch("/update/:id", authenticate, authorize("CUSTOMER"), updateBooking);
router.patch("/:id", authenticate, authorize("CUSTOMER"), updateBooking);

/* ADMIN ANALYTICS */
router.get("/admin-analytics", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getAdminAnalytics);

/* ADMIN DAILY SCHEDULE */
router.get("/schedule", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getDailySchedule);

/* ADD PAYMENT */
router.post("/add-payment/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), addPayment);
router.post("/:id/confirm-downpayment", authenticate, authorize("ADMIN", "SUPER_ADMIN"), confirmDownpayment);

/* REQUEST DOWNPAYMENT */
router.post("/request-downpayment/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), requestDownpayment);
router.post("/:id/request-downpayment", authenticate, authorize("ADMIN", "SUPER_ADMIN"), requestDownpayment);

/* ADD SERVICE TO BOOKING */
router.post("/add-service/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), addServiceToBooking);
router.post("/:id/add-service", authenticate, authorize("ADMIN", "SUPER_ADMIN"), addServiceToBooking);

/* ASSIGN STAFF */
router.patch("/assign/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), assignStaff);
router.patch("/:id/assign", authenticate, authorize("ADMIN", "SUPER_ADMIN"), assignStaff);

/* UPDATE STATUS - CUSTOMER, STAFF, ADMIN all allowed (controller enforces) */
router.patch("/status/:id", authenticate, updateBookingStatus);
router.patch("/:id/status", authenticate, updateBookingStatus);

/* RECORD PAYMENT */
router.patch("/payment/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN", "STAFF"), recordPayment);
router.patch("/:id/payment", authenticate, authorize("ADMIN", "SUPER_ADMIN", "STAFF"), recordPayment);

/* CANCEL BOOKING */
router.patch("/cancel/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), cancelBooking);

/* CUSTOMER REQUEST CANCEL */
router.patch("/request-cancel/:id", authenticate, authorize("CUSTOMER"), requestCustomerCancel);

/* STAFF REQUEST CANCEL */
router.post("/:id/request-cancel", authenticate, authorize("STAFF"), requestCancelBooking);

/* ================= ADDON REQUESTS ================= */

router.post("/:bookingId/addon-request", authenticate, authorize("CUSTOMER"), createAddonRequest);
router.get("/:bookingId/addon-requests", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getAddonRequests);
router.patch("/addon-requests/:id/approve", authenticate, authorize("ADMIN", "SUPER_ADMIN"), approveAddonRequest);
router.patch("/addon-requests/:id/reject", authenticate, authorize("ADMIN", "SUPER_ADMIN"), rejectAddonRequest);

/* ================= LAST ================= */

router.get("/:id", authenticate, getBookingById);

module.exports = router;

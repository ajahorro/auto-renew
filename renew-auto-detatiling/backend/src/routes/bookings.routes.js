const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");
const bookingsController = require("../controllers/bookings.controller");


// CUSTOMER creates booking
router.post(
  "/",
  authenticate,
  authorize("CUSTOMER"),
  bookingsController.createBooking
);


// Logged-in users view bookings (filtered by role in controller)
router.get(
  "/",
  authenticate,
  bookingsController.getBookings
);


// Get booking details
router.get(
  "/:id",
  authenticate,
  bookingsController.getBookingById
);


// Assign staff (ADMIN + SUPER_ADMIN)
router.patch(
  "/:id/assign",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  bookingsController.assignStaff
);


// Update booking status
router.patch(
  "/:id/status",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "STAFF"),
  bookingsController.updateBookingStatus
);


// Record payment
router.patch(
  "/:id/payment",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "STAFF"),
  bookingsController.recordPayment
);


// Cancel booking
router.patch(
  "/:id/cancel",
  authenticate,
  authorize("CUSTOMER", "ADMIN", "SUPER_ADMIN"),
  bookingsController.cancelBooking
);


// Availability
router.get(
  "/availability",
  authenticate,
  bookingsController.getAvailability
);

module.exports = router;
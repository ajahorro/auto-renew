const express = require("express");

const authenticate = require("./middleware/auth.middleware");
const authorize = require("./middleware/rbac.middleware");

const servicesRoutes = require("./routes/services.routes");
const bookingsRoutes = require("./routes/bookings.routes");
const notificationsRoutes = require("./routes/notifications.routes");

const authController = require("./controllers/auth.controller");
const bookingsController = require("./controllers/bookings.controller");

const router = express.Router();

router.use("/services", servicesRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/notifications", notificationsRoutes);

router.post("/auth/register", authController.registerCustomer);
router.post("/auth/login", authController.login);

router.get("/me", authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.get("/admin-dashboard", authenticate, authorize("ADMIN", "SUPER_ADMIN"), (req, res) => {
  res.json({ success: true, message: "Welcome Admin Dashboard", user: req.user });
});

router.get("/staff-dashboard", authenticate, authorize("STAFF"), (req, res) => {
  res.json({ success: true, message: "Welcome Staff Dashboard", user: req.user });
});

router.get("/customer-dashboard", authenticate, authorize("CUSTOMER"), (req, res) => {
  res.json({ success: true, message: "Welcome Customer Dashboard", user: req.user });
});

router.get("/admin/analytics", authenticate, authorize("ADMIN", "SUPER_ADMIN"), bookingsController.getAdminAnalytics);

router.get("/staff/schedule", authenticate, authorize("STAFF"), bookingsController.getStaffSchedule);

router.get("/admin/users", authenticate, authorize("ADMIN", "SUPER_ADMIN"), authController.getAllUsers);

router.patch("/admin/users/:id/role", authenticate, authorize("ADMIN", "SUPER_ADMIN"), authController.updateUserRole);

router.patch("/admin/users/:id/deactivate", authenticate, authorize("ADMIN", "SUPER_ADMIN"), authController.deactivateUser);

module.exports = router;
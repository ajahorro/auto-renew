const express = require("express");

/* ===============================
MIDDLEWARE
=============================== */

const authenticate = require("./middleware/auth.middleware");
const authorize = require("./middleware/rbac.middleware");

/* ===============================
PRISMA (AVAILABLE FOR ROUTES IF NEEDED)
=============================== */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/* ===============================
ROUTES IMPORT
=============================== */

const servicesRoutes = require("./routes/services.routes");
const bookingsRoutes = require("./routes/bookings.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const settingsRoutes = require("./routes/settings.routes");
const usersRoutes = require("./routes/users.routes");

/* ===============================
CONTROLLERS
=============================== */

const authController = require("./controllers/auth.controller");
const bookingsController = require("./controllers/bookings.controller");
const paymentsRoutes = require("./routes/payments.routes");

/* ===============================
ROUTER INIT
=============================== */

const router = express.Router();

/* =========================================================
SYSTEM TEST ROUTES (FOR DEBUGGING)
========================================================= */

router.get("/test-route", (req, res) => {
  res.json({
    success: true,
    message: "Main router working",
    timestamp: new Date()
  });
});

router.get("/system-status", (req, res) => {
  res.json({
    success: true,
    system: "RENEW Auto Detailing API",
    status: "Running",
    routesLoaded: true
  });
});

/* =========================================================
AUTH ROUTES
========================================================= */

router.post("/auth/register/initiate", authController.initiateRegistration);
router.post("/auth/register/verify", authController.verifyRegistrationOtp);
router.post("/auth/register/resend-otp", authController.resendRegistrationOtp);
router.post("/auth/login", authController.login);
router.post("/auth/forgot-password", authController.forgotPassword);
router.post("/auth/reset-password", authController.resetPassword);

/* =========================================================
CURRENT USER PROFILE
========================================================= */

router.get("/me", authenticate, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

/* =========================================================
CUSTOMER PROFILE UPDATE (NAME CHANGE)
========================================================= */

router.patch(
  "/users/update-name",
  authenticate,
  authController.updateProfile
);

/* =========================================================
OPTIONAL PROFILE DEBUG ROUTE
========================================================= */

router.get(
  "/users/profile",
  authenticate,
  async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: req.user.id
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true
        }
      });

      res.json({
        success: true,
        user
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to load profile"
      });
    }
  }
);

/* =========================================================
MODULE ROUTES (BUSINESS LOGIC MODULES)
========================================================= */

router.get(
  "/admin-dashboard",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome Admin Dashboard",
      user: req.user
    });
  }
);

router.get(
  "/staff-dashboard",
  authenticate,
  authorize("STAFF"),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome Staff Dashboard",
      user: req.user
    });
  }
);

router.get(
  "/customer-dashboard",
  authenticate,
  authorize("CUSTOMER"),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome Customer Dashboard",
      user: req.user
    });
  }
);

/* =========================================================
ADMIN ANALYTICS
========================================================= */

router.get(
  "/admin/analytics",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  bookingsController.getAdminAnalytics
);

/* =========================================================
STAFF SCHEDULE
========================================================= */

router.get(
  "/staff/schedule",
  authenticate,
  authorize("STAFF"),
  bookingsController.getStaffSchedule
);

/* =========================================================
   ADMIN USER MANAGEMENT
========================================================= */

router.get(
  "/admin/users",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  authController.getAllUsers
);

router.post(
  "/admin/users",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  authController.createUser
);

router.patch(
  "/admin/users/:id/role",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  authController.updateUserRole
);

router.patch(
  "/admin/users/:id/deactivate",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  authController.deactivateUser
);

router.patch(
  "/admin/users/:id/activate",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  authController.activateUser
);

/* =========================================================
   USER PROFILE & PASSWORD (ALL ROLES)
========================================================= */

router.patch(
  "/users/me",
  authenticate,
  authController.updateProfile
);

router.patch(
  "/users/me/password",
  authenticate,
  authController.changePassword
);

/* =========================================================
ADMIN USER DETAIL (OPTIONAL MANAGEMENT)
========================================================= */

router.get(
  "/admin/users/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: req.params.id
        }
      });

      res.json({
        success: true,
        user
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to load user"
      });
    }
  }
);

router.use("/services", servicesRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/settings", settingsRoutes);
router.use("/users", usersRoutes);
router.use("/payments", paymentsRoutes);

/* =========================================================
EXPORT ROUTER
========================================================= */

module.exports = router;
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const bcrypt = require("bcryptjs");

const prisma = require("./config/prisma");
const ensureBusinessSettings = require("./config/defaultSettings");
const normalizeLegacyBookingData = require("./config/normalizeLegacyData");
const sendBookingReminders = require("./jobs/bookingReminders");
const syncBookingLifecycleStates = require("./jobs/bookingLifecycle");
const rateLimiter = require("./middleware/rateLimiter.middleware");

// Routes
const servicesRoutes = require("./routes/services.routes");
const bookingsRoutes = require("./routes/bookings.routes");
const paymentsRoutes = require("./routes/payments.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const usersRoutes = require("./routes/users.routes");
const businessSettingsRoutes = require("./routes/businessSettings.routes");
const cancellationsRoutes = require("./routes/cancellations.routes");
const communicationsRoutes = require("./routes/communications.routes");
const refundsRoutes = require("./routes/refunds.routes");
const auditRoutes = require("./routes/audit.routes");
const authController = require("./controllers/auth.controller");

// Middleware
const authenticate = require("./middleware/auth.middleware");
const authorize = require("./middleware/rbac.middleware");

const app = express();

/*  MIDDLEWARE*/
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});
app.use(rateLimiter);

/*  HEALTH CHECK */
app.get("/", (req, res) => {
  res.json({ message: "RENEW Auto Detailing API running" });
});

app.get("/api/health-check", (req, res) => {
  res.json({ success: true, status: "OK", timestamp: new Date() });
});

/* AUTH ROUTES (PUBLIC)*/
app.post("/api/auth/register/initiate", authController.initiateRegistration);
app.post("/api/auth/register/verify-otp", authController.verifyRegistrationOtp);
app.post("/api/auth/register/resend-otp", authController.resendRegistrationOtp);
app.post("/api/auth/login", authController.login);
app.post("/api/auth/forgot-password", authController.forgotPassword);
app.post("/api/auth/reset-password", authController.resetPassword);

/* AUTH ROUTES (PROTECTED) */
app.post("/api/auth/send-email-otp", authenticate, authController.sendEmailOtp);
app.post("/api/auth/verify-email-otp", authenticate, authController.verifyEmailOtp);

app.get("/api/audit-logs", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { entityType, action, userId, bookingId } = req.query;
    const where = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (bookingId) where.bookingId = Number(bookingId);

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        performer: {
          select: { id: true, fullName: true, role: true }
        },
        booking: {
          select: { id: true, customerId: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    res.json({ success: true, logs });
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/* MAIN ROUTES*/
app.use("/api/services", servicesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/business-settings", businessSettingsRoutes);
app.use("/api/cancellations", cancellationsRoutes);
app.use("/api/communications", communicationsRoutes);
app.use("/api/refunds", refundsRoutes);

/* USER PROFILE */
app.get("/api/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        notifyEmail: true,
        notifyWeb: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("GET /api/me ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to load current user" });
  }
});

/* ADMIN USER MANAGEMENT */
app.get("/api/admin/users", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { role } = req.query;
    const where = {};
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error("GET /api/admin/users ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to load users" });
  }
});

/* GLOBAL ERROR HANDLER */
app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({
    success: false,
    message: "Something went wrong on the server",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

/* START SERVER */
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Ensure essential database records exist
    console.log("[INIT] Ensuring business settings...");
    await ensureBusinessSettings();
    
    console.log("[INIT] Normalizing legacy booking data...");
    await normalizeLegacyBookingData();

    // 2. Start scheduled tasks
    console.log("[CRON] Initializing scheduled jobs...");
    
    // Booking reminders (runs every 30 mins)
    cron.schedule("*/30 * * * *", async () => {
      console.log("[CRON] Running booking reminders check...");
      await sendBookingReminders();
    });

    // Lifecycle sync (runs every 15 mins)
    cron.schedule("*/15 * * * *", async () => {
      console.log("[CRON] Syncing booking lifecycle states...");
      await syncBookingLifecycleStates();
    });

    // 3. Listen
    app.listen(PORT, () => {
      console.log(`\n🚀 RENEW API Server started on port ${PORT}`);
      console.log(`🔗 Local URL: http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("\n❌ FAILED TO START SERVER:", error);
    process.exit(1);
  }
}

startServer();

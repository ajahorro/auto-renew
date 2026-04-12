require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const bcrypt = require("bcryptjs");

const prisma = require("./config/prisma");
const ensureBusinessSettings = require("./config/defaultSettings");
const sendBookingReminders = require("./jobs/bookingReminders");

// Routes
const servicesRoutes = require("./routes/services.routes");
const bookingsRoutes = require("./routes/bookings.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const usersRoutes = require("./routes/users.routes");
const businessSettingsRoutes = require("./routes/businessSettings.routes");
const authController = require("./controllers/auth.controller");

// Middleware
const authenticate = require("./middleware/auth.middleware");
const authorize = require("./middleware/rbac.middleware");

const app = express();

/*  MIDDLEWARE*/
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

/*  HEALTH CHECK */
app.get("/", (req, res) => {
  res.json({ message: "RENEW Auto Detailing API running" });
});

/* AUTH ROUTES (PUBLIC)*/
app.post("/api/auth/register/initiate", authController.initiateRegistration);
app.post("/api/auth/register/verify", authController.verifyRegistrationOtp);
app.post("/api/auth/register/resend-otp", authController.resendRegistrationOtp);
app.post("/api/auth/login", authController.login);
app.post("/api/auth/forgot-password", authController.forgotPassword);
app.post("/api/auth/reset-password", authController.resetPassword);

/* MAIN ROUTES*/
app.use("/api/services", servicesRoutes);
app.use("/api/bookings", bookingsRoutes); 
app.use("/api/notifications", notificationsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/business-settings", businessSettingsRoutes);

/* USER PROFILE */
app.get("/api/me", authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

/* ADMIN USER MANAGEMENT */
app.get("/api/admin/users", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { role } = req.query;
    const where = role ? { role } : {};

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        active: true,
        createdAt: true,
        _count: {
          select: { bookings: true, assignedBookings: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

app.post("/api/admin/users", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { email, password, fullName, role = "STAFF" } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, fullName, role },
      select: { id: true, email: true, fullName: true, role: true, active: true, createdAt: true }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to create user" });
  }
});

app.patch("/api/admin/users/:id/deactivate", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { active: false }
    });
    res.json({ success: true, message: "User deactivated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to deactivate user" });
  }
});

app.patch("/api/admin/users/:id/activate", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { active: true }
    });
    res.json({ success: true, message: "User activated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to activate user" });
  }
});

/* BOOKING REMINDER CRON*/
cron.schedule("0 * * * *", async () => {
  try {
    console.log("Running booking reminder job...");
    await sendBookingReminders();
  } catch (error) {
    console.error("REMINDER CRON ERROR:", error);
  }
});

/* ERROR HANDLER */
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

/* SERVER START*/
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await ensureBusinessSettings();
  console.log(`Server running on port ${PORT}`);
});
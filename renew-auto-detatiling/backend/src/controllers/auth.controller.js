const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/* INITIATE OTP REGISTRATION */
const initiateRegistration = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const fullName = String(req.body.fullName || "").trim();
    const phone = req.body.phone ? String(req.body.phone).trim() : null;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and full name are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.pendingRegistration.deleteMany({
      where: { email }
    });

    const pendingReg = await prisma.pendingRegistration.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        phone,
        otp,
        expiresAt
      }
    });

    console.log(`[REGISTRATION OTP] Code for ${email}: ${otp}`);

    res.json({
      success: true,
      message: "Verification code sent to your email",
      expiresIn: 900
    });

  } catch (error) {
    console.error("INITIATE REGISTRATION ERROR:", error);
    next(error);
  }
};

/* VERIFY OTP AND COMPLETE REGISTRATION */
const verifyRegistrationOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    const pendingReg = await prisma.pendingRegistration.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        expiresAt: { gt: new Date() }
      }
    });

    if (!pendingReg) {
      return res.status(400).json({
        success: false,
        message: "Registration session expired or invalid. Please register again."
      });
    }

    if (pendingReg.otp !== otp.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code"
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: pendingReg.email }
    });

    if (existingUser) {
      await prisma.pendingRegistration.delete({
        where: { id: pendingReg.id }
      });
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    const user = await prisma.user.create({
      data: {
        email: pendingReg.email,
        password: pendingReg.password,
        fullName: pendingReg.fullName,
        phone: pendingReg.phone,
        role: "CUSTOMER"
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
      }
    });

    await prisma.pendingRegistration.delete({
      where: { id: pendingReg.id }
    });

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      message: "Account created successfully",
      token,
      user
    });

  } catch (error) {
    console.error("VERIFY REGISTRATION OTP ERROR:", error);
    next(error);
  }
};

/* RESEND REGISTRATION OTP */
const resendRegistrationOtp = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const pendingReg = await prisma.pendingRegistration.findFirst({
      where: { email }
    });

    if (!pendingReg) {
      return res.status(400).json({
        success: false,
        message: "No pending registration found. Please register again."
      });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.pendingRegistration.update({
      where: { id: pendingReg.id },
      data: { otp: newOtp, expiresAt }
    });

    console.log(`[RESEND REGISTRATION OTP] Code for ${email}: ${newOtp}`);

    res.json({
      success: true,
      message: "New verification code sent",
      expiresIn: 900
    });

  } catch (error) {
    console.error("RESEND OTP ERROR:", error);
    next(error);
  }
};


/* LOGIN */

const login = async (req, res, next) => {

  try {

    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required"
      });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    if (user.active === false) {
      return res.status(403).json({
        success: false,
        message: "Account is disabled"
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

const token = jwt.sign(
  {
    id: user.id,
    email: user.email,
    role: user.role
  },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }
);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });

  } catch (error) {
    next(error);
  }

};


/* FORGOT PASSWORD */

const forgotPassword = async (req, res, next) => {

  try {

    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required"
      });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.json({
        success: true,
        message: "If the email exists, reset instructions were sent"
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    const expiry = new Date(Date.now() + 1000 * 60 * 30);

    await prisma.user.update({
      where: { email },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry
      }
    });

    res.json({
      success: true,
      message: "Password reset token generated",
      resetToken: token
    });

  } catch (error) {
    next(error);
  }

};


/* RESET PASSWORD */

const resetPassword = async (req, res, next) => {

  try {

    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({
      success: true,
      message: "Password reset successful"
    });

  } catch (error) {
    next(error);
  }

};


/* GET ALL USERS (ADMIN) */
const getAllUsers = async (req, res) => {
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
};

/* UPDATE USER ROLE (ADMIN) */
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["ADMIN", "SUPER_ADMIN", "STAFF", "CUSTOMER"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to update role" });
  }
};

/* DEACTIVATE USER (ADMIN) */
const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: { active: false }
    });

    res.json({ success: true, message: "User deactivated" });
  } catch (error) {
    console.error("DEACTIVATE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to deactivate user" });
  }
};

/* ACTIVATE USER (ADMIN) */
const activateUser = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: { active: true }
    });

    res.json({ success: true, message: "User activated" });
  } catch (error) {
    console.error("ACTIVATE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to activate user" });
  }
};

/* CREATE USER (ADMIN) - For creating staff */
const createUser = async (req, res) => {
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
};

/* UPDATE CURRENT USER PROFILE */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName } = req.body;

    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Name must be at least 2 characters" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { fullName: fullName.trim() },
      select: { id: true, email: true, fullName: true, role: true }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

/* CHANGE PASSWORD */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both passwords required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to change password" });
  }
};

/* SEND EMAIL OTP */
const sendEmailOtp = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email is already in use" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.emailVerification.deleteMany({
      where: { email }
    });

    await prisma.emailVerification.create({
      data: {
        email,
        otp,
        expiresAt,
        type: "EMAIL_CHANGE"
      }
    });

    console.log(`[EMAIL OTP] Code for ${email}: ${otp}`);

    res.json({
      success: true,
      message: "Verification code sent to email",
      otp
    });
  } catch (error) {
    console.error("SEND EMAIL OTP ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to send verification code" });
  }
};

/* VERIFY EMAIL OTP */
const verifyEmailOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        otp,
        type: "EMAIL_CHANGE",
        expiresAt: { gt: new Date() }
      }
    });

    if (!verification) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { email }
    });

    await prisma.emailVerification.delete({
      where: { id: verification.id }
    });

    res.json({
      success: true,
      message: "Email verified and updated successfully"
    });
  } catch (error) {
    console.error("VERIFY EMAIL OTP ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to verify email" });
  }
};

/* ARCHIVE USER (SOFT DELETE) */
const archiveUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Cannot archive admin accounts" });
    }

    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() + 15);

    await prisma.user.update({
      where: { id },
      data: {
        archivedAt: archiveDate,
        active: false
      }
    });

    res.json({
      success: true,
      message: "User archived successfully. Will be permanently deleted after 15 days."
    });
  } catch (error) {
    console.error("ARCHIVE USER ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to archive user" });
  }
};

/* RESTORE ARCHIVED USER */
const restoreUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await prisma.user.update({
      where: { id },
      data: {
        archivedAt: null,
        active: true
      }
    });

    res.json({
      success: true,
      message: "User restored successfully"
    });
  } catch (error) {
    console.error("RESTORE USER ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to restore user" });
  }
};

/* CLEANUP EXPIRED ARCHIVED USERS (CALLED BY CRON) */
const cleanupExpiredArchives = async () => {
  try {
    const expiredUsers = await prisma.user.findMany({
      where: {
        archivedAt: { lt: new Date() }
      }
    });

    for (const user of expiredUsers) {
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`Deleted expired user: ${user.email}`);
    }

    return expiredUsers.length;
  } catch (error) {
    console.error("CLEANUP ERROR:", error);
    return 0;
  }
};

module.exports = {
  initiateRegistration,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  login,
  forgotPassword,
  resetPassword,
  getAllUsers,
  updateUserRole,
  deactivateUser,
  activateUser,
  createUser,
  updateProfile,
  changePassword,
  sendEmailOtp,
  verifyEmailOtp,
  archiveUser,
  restoreUser,
  cleanupExpiredArchives
};
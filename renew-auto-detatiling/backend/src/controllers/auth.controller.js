const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../services/email.service");

const LOG_REQUEST = (req, context) => {
  console.log(`[${context}] Request Body:`, JSON.stringify(req.body, null, 2));
  console.log(`[${context}] Request Params:`, JSON.stringify(req.params, null, 2));
  console.log(`[${context}] Request Query:`, JSON.stringify(req.query, null, 2));
};

const rateLimitStore = new Map();

const checkRateLimit = (email, maxAttempts = 3, windowMs = 10 * 60 * 1000) => {
  const key = `register:${email}`;
  const now = Date.now();
  
  const record = rateLimitStore.get(key);
  
  if (!record || now - record.windowStart > windowMs) {
    rateLimitStore.set(key, { attempts: 1, windowStart: now });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  
  if (record.attempts >= maxAttempts) {
    const waitTime = Math.ceil((windowMs - (now - record.windowStart)) / 1000);
    return { allowed: false, waitSeconds: waitTime };
  }
  
  record.attempts++;
  return { allowed: true, remaining: maxAttempts - record.attempts };
};

const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};



const sendOtpEmail = async (email, otp, purpose = "verification") => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">RENEW Auto Detailing</h2>
      <p>Your verification code is:</p>
      <div style="background: #f3f4f6; padding: 16px; text-align: center; font-size: 24px; letter-spacing: 8px; font-weight: bold; border-radius: 8px;">
        ${otp}
      </div>
      <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
      <p style="color: #6b7280; font-size: 12px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;

  return sendEmail(email, `Your ${purpose} Code - RENEW Auto Detailing`, html);
};

const initiateRegistration = async (req, res) => {
  try {
    LOG_REQUEST(req, "INITIATE_REGISTRATION");
    
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

    const rateCheck = checkRateLimit(email, 3, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many requests. Please wait ${rateCheck.waitSeconds} seconds.`
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

    await prisma.pendingRegistration.deleteMany({
      where: { email }
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.pendingRegistration.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        phone,
        otp,
        expiresAt
      }
    });

    const emailResult = await sendOtpEmail(email, otp, "Registration");

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send registration email",
        error: emailResult.error
      });
    }

    res.json({
      success: true,
      message: "Verification code sent to your email",
      expiresIn: 600
    });

  } catch (error) {
    console.error("ERROR [INITIATE_REGISTRATION]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const verifyRegistrationOtp = async (req, res) => {
  try {
    LOG_REQUEST(req, "VERIFY_REGISTRATION_OTP");
    
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const pendingReg = await prisma.pendingRegistration.findFirst({
      where: {
        email: cleanEmail,
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
      where: { email: cleanEmail }
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
        email: cleanEmail,
        password: pendingReg.password,
        fullName: pendingReg.fullName,
        phone: pendingReg.phone,
        role: "CUSTOMER",
        emailVerified: true
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
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Account created successfully",
      token,
      user
    });

  } catch (error) {
    console.error("ERROR [VERIFY_REGISTRATION_OTP]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const resendRegistrationOtp = async (req, res) => {
  try {
    LOG_REQUEST(req, "RESEND_REGISTRATION_OTP");
    
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const rateCheck = checkRateLimit(`resend:${email}`, 5, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many resend requests. Please wait ${rateCheck.waitSeconds} seconds.`
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

    const newOtp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.pendingRegistration.update({
      where: { id: pendingReg.id },
      data: { otp: newOtp, expiresAt }
    });

    const emailResult = await sendOtpEmail(email, newOtp, "Registration");

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend verification email",
        error: emailResult.error
      });
    }

    res.json({
      success: true,
      message: "New verification code sent",
      expiresIn: 600
    });

  } catch (error) {
    console.error("ERROR [RESEND_REGISTRATION_OTP]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    LOG_REQUEST(req, "LOGIN");
    
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

    if (user.isActive === false) {
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
      console.error("JWT_SECRET is not defined");
      return res.status(500).json({
        success: false,
        message: "Server configuration error. Please contact administrator."
      });
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
        role: user.role,
        notifyEmail: user.notifyEmail ?? false,
        notifyWeb: user.notifyWeb ?? true
      }
    });

  } catch (error) {
    console.error("ERROR [LOGIN]:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    LOG_REQUEST(req, "FORGOT_PASSWORD");
    
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

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.emailVerification.deleteMany({ where: { email } });
    
    await prisma.emailVerification.create({
      data: {
        email,
        otp,
        type: "PASSWORD_RESET",
        expiresAt
      }
    });

    const emailResult = await sendOtpEmail(email, otp, "Password Reset");

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email",
        error: emailResult.error
      });
    }

    res.json({
      success: true,
      message: "Password reset code sent to email"
    });

  } catch (error) {
    console.error("ERROR [FORGOT_PASSWORD]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    LOG_REQUEST(req, "RESET_PASSWORD");
    
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        otp,
        type: "PASSWORD_RESET",
        expiresAt: { gt: new Date() }
      }
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });

    await prisma.emailVerification.delete({
      where: { id: verification.id }
    });

    res.json({
      success: true,
      message: "Password reset successful"
    });

  } catch (error) {
    console.error("ERROR [RESET_PASSWORD]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    LOG_REQUEST(req, "GET_ALL_USERS");
    
    const { role } = req.query;
    const where = role ? { role } : {};

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { bookings: true, assignedBookings: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error("ERROR [GET_ALL_USERS]:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const updateUserRole = async (req, res) => {
  try {
    LOG_REQUEST(req, "UPDATE_USER_ROLE");
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ["ADMIN", "SUPER_ADMIN", "STAFF", "CUSTOMER"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error("ERROR [UPDATE_USER_ROLE]:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

const deactivateUser = async (req, res) => {
  try {
    LOG_REQUEST(req, "DEACTIVATE_USER");
    
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "CUSTOMER") {
      return res.status(403).json({ success: false, message: "Cannot deactivate customer accounts through admin panel" });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ success: true, message: "User deactivated" });
  } catch (error) {
    console.error("ERROR [DEACTIVATE_USER]:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const activateUser = async (req, res) => {
  try {
    LOG_REQUEST(req, "ACTIVATE_USER");
    
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "CUSTOMER") {
      return res.status(403).json({ success: false, message: "Cannot activate customer accounts through admin panel" });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: true }
    });

    res.json({ success: true, message: "User activated" });
  } catch (error) {
    console.error("ERROR [ACTIVATE_USER]:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const createUser = async (req, res) => {
  try {
    LOG_REQUEST(req, "CREATE_USER");
    
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
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error("ERROR [CREATE_USER]:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    LOG_REQUEST(req, "UPDATE_PROFILE");
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    const userId = req.user.id;
    const { fullName, phone, notifyEmail, notifyWeb } = req.body;

    const updateData = {};
    
    if (fullName !== undefined) {
      if (typeof fullName !== "string" || fullName.trim().length < 2) {
        return res.status(400).json({ 
          success: false, 
          message: "Name must be at least 2 characters" 
        });
      }
      updateData.fullName = fullName.trim();
    }
    
    if (phone !== undefined) {
      updateData.phone = phone ? String(phone).trim() : null;
    }
    
    if (notifyEmail !== undefined) {
      updateData.notifyEmail = Boolean(notifyEmail);
    }
    
    if (notifyWeb !== undefined) {
      updateData.notifyWeb = Boolean(notifyWeb);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No valid fields to update" 
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { 
        id: true, 
        email: true, 
        fullName: true, 
        phone: true,
        role: true,
        notifyEmail: true,
        notifyWeb: true
      }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error("ERROR [UPDATE_PROFILE]:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

const changePassword = async (req, res) => {
  try {
    LOG_REQUEST(req, "CHANGE_PASSWORD");
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both passwords required" });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

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
    console.error("ERROR [CHANGE_PASSWORD]:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

const initiateOtpLogin = async (req, res) => {
  try {
    LOG_REQUEST(req, "INITIATE_OTP_LOGIN");
    const { email } = req.body;

    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      // Security: Don't reveal if user exists
      return res.json({ success: true, message: "If the email exists, a verification code has been sent." });
    }

    if (!user.isActive) return res.status(403).json({ success: false, message: "Account is disabled" });

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await prisma.otpVerification.upsert({
      where: { userId: user.id },
      update: { otpHash, expiresAt, attempts: 0, verifiedAt: null },
      create: { userId: user.id, otpHash, expiresAt }
    });

    await sendOtpEmail(user.email, otp, "Login");

    res.json({ success: true, message: "Verification code sent to your email." });
  } catch (error) {
    console.error("INITIATE_OTP_LOGIN ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

const verifyOtpLogin = async (req, res) => {
  try {
    LOG_REQUEST(req, "VERIFY_OTP_LOGIN");
    const { email, otp } = req.body;

    if (!email || !otp) return res.status(400).json({ success: false, message: "Email and OTP required" });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { otpVerification: true }
    });

    if (!user || !user.otpVerification) return res.status(400).json({ success: false, message: "Invalid request" });

    const { otpVerification } = user;

    if (otpVerification.attempts >= 5) {
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please request a new code." });
    }

    if (new Date() > otpVerification.expiresAt) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    const isValid = await bcrypt.compare(otp, otpVerification.otpHash);
    if (!isValid) {
      await prisma.otpVerification.update({
        where: { id: otpVerification.id },
        data: { attempts: { increment: 1 } }
      });
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Success
    await prisma.otpVerification.update({
      where: { id: otpVerification.id },
      data: { verifiedAt: new Date(), attempts: 0 }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
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
    console.error("VERIFY_OTP_LOGIN ERROR:", error);
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

const sendEmailOtp = async (req, res) => {
  try {
    LOG_REQUEST(req, "SEND_EMAIL_OTP");
    const { email } = req.body;
    const userId = req.user.id;

    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    // Ensure email not taken
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
    if (existing) return res.status(400).json({ success: false, message: "Email already in use" });

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpVerification.upsert({
      where: { userId },
      update: { otpHash, expiresAt, attempts: 0, verifiedAt: null },
      create: { userId, otpHash, expiresAt }
    });

    await sendOtpEmail(email, otp, "Email Update");

    res.json({ success: true, message: "Verification code sent." });
  } catch (error) {
    console.error("SEND_EMAIL_OTP ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    LOG_REQUEST(req, "VERIFY_EMAIL_OTP");
    const { email, otp } = req.body;
    const userId = req.user.id;

    const verification = await prisma.otpVerification.findUnique({
      where: { userId }
    });

    if (!verification || new Date() > verification.expiresAt) {
      return res.status(400).json({ success: false, message: "OTP expired or not found" });
    }

    if (verification.attempts >= 5) {
      return res.status(429).json({ success: false, message: "Too many attempts" });
    }

    const isValid = await bcrypt.compare(otp, verification.otpHash);
    if (!isValid) {
      await prisma.otpVerification.update({ where: { userId }, data: { attempts: { increment: 1 } } });
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Success
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { email, emailVerified: true } }),
      prisma.otpVerification.update({ where: { userId }, data: { verifiedAt: new Date(), attempts: 0 } })
    ]);

    res.json({ success: true, message: "Email updated successfully" });
  } catch (error) {
    console.error("VERIFY_EMAIL_OTP ERROR:", error);
    res.status(500).json({ success: false, message: "Verification failed" });
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
  initiateOtpLogin,
  verifyOtpLogin
};

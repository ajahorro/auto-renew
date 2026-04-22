const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");
const bcrypt = require("bcryptjs");

const authController = require("../controllers/auth.controller");

/* ===============================
   GET USERS
=============================== */
router.get("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { role } = req.query;
    const where = {};
    if (role) where.role = String(role).toUpperCase();
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ success: true, users });
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

/* ===============================
   CREATE USER (ADMIN ONLY)
 =============================== */
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), authController.createUser);

/* ===============================
   UPDATE USER ROLE
 =============================== */
router.patch("/:id/role", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ success: false, message: "Role required" });
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role }
    });
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to update role" });
  }
});

/* ===============================
   DEACTIVATE / ARCHIVE USER
 =============================== */
router.patch("/:id/archive", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "CUSTOMER") {
      return res.status(403).json({ 
        success: false, 
        message: user.role === "CUSTOMER" ? "Cannot archive customer accounts from here" : "Cannot deactivate admin accounts" 
      });
    }
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true, message: "User deactivated" });
  } catch (error) {
    console.error("DEACTIVATE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to deactivate user" });
  }
});

router.patch("/:id/deactivate", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "CUSTOMER") {
      return res.status(403).json({ 
        success: false, 
        message: user.role === "CUSTOMER" ? "Cannot deactivate customer accounts" : "Cannot deactivate admin accounts" 
      });
    }
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true, message: "User deactivated" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed" });
  }
});

/* ===============================
   ACTIVATE / RESTORE USER
 =============================== */
router.patch("/:id/restore", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.update({ where: { id }, data: { isActive: true } });
    res.json({ success: true, message: "User activated successfully" });
  } catch (error) {
    console.error("RESTORE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to restore user" });
  }
});

router.patch("/:id/activate", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.update({ where: { id }, data: { isActive: true } });
    res.json({ success: true, message: "User activated" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed" });
  }
});

/* ===============================
   PERMANENTLY DELETE USER
 =============================== */
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    // Admin is NOT allowed to delete customer accounts
    if (user.role === "CUSTOMER") {
      return res.status(403).json({ success: false, message: "Deletion of customer accounts is restricted. Customers must request deletion themselves." });
    }
    
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: "User permanently deleted" });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

/* ===============================
   PROFILE MANAGEMENT
 =============================== */
router.get("/me", authenticate, async (req, res) => {
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
        createdAt: true
      }
    });
    res.json({ success: true, user });
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to load profile" });
  }
});

router.patch("/me", authenticate, async (req, res) => {
  try {
    const { fullName, phone, email, notifyEmail, notifyWeb } = req.body;
    const updateData = { fullName, phone };
    if (email) updateData.email = email;
    if (notifyEmail !== undefined) updateData.notifyEmail = notifyEmail;
    if (notifyWeb !== undefined) updateData.notifyWeb = notifyWeb;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
});

router.patch("/me/password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ success: false, message: "Current password is incorrect" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed }
    });
    res.json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to change password" });
  }
});

router.post("/me/request-delete", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    await prisma.user.update({ where: { id: req.user.id }, data: { isActive: false } });
    res.json({ success: true, message: "Account deletion scheduled." });
  } catch (error) {
    console.error("REQUEST DELETE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to request account deletion" });
  }
});

router.all("*", (req, res) => {
  console.log(`[DEBUG] Unmatched route in users.routes.js: ${req.method} ${req.url}`);
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found in users router` });
});

module.exports = router;

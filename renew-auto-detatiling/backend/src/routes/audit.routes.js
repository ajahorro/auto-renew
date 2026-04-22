const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");

// GET ALL AUDIT LOGS (ADMIN ONLY)
router.get("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { entityType, action, userId, bookingId } = req.query;

    const where = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (bookingId) where.bookingId = bookingId;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        performer: {
          select: { id: true, fullName: true, role: true }
        }
      },
      take: 100 
    });

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;

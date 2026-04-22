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
        // Since AuditLog model in schema doesn't have explicit relations, 
        // we might need to manually fetch user details if needed, 
        // but for now let's just return the raw logs.
        // Wait, I should check if I can add a relation.
      },
      take: 100 // Limit to latest 100 for performance
    });

    // Manually attach user names if userId exists
    const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, role: true }
    });

    const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {});

    const enrichedLogs = logs.map(l => ({
      ...l,
      performer: userMap[l.userId] || { fullName: "System" }
    }));

    res.json({
      success: true,
      logs: enrichedLogs
    });
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;

const express = require("express");

const router = express.Router();

const prisma = require("../config/prisma");

const authenticate = require("../middleware/auth.middleware");

/* ===============================
   GET USER NOTIFICATIONS
=============================== */

router.get("/", authenticate, async (req, res) => {

  try {

    const userId = req.user.id;

    const notifications = await prisma.notification.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json({
      success: true,
      notifications
    });

  } catch (error) {

    console.error("GET NOTIFICATIONS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications"
    });

  }

});

/* ===============================
   MARK AS READ
============================== */
router.patch("/:id/read", authenticate, async (req, res) => {

  try {

    const id = Number(req.params.id);

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not allowed"
      });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json({
      success: true,
      notification: updated
    });

  } catch (error) {

    console.error("MARK NOTIFICATION READ ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notification"
    });

  }

});

/* ===============================
   MARK ALL AS READ
============================== */
router.patch("/read-all", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: { isRead: true }
    });

    res.json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (error) {
    console.error("MARK ALL READ ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all as read"
    });
  }
});

/* ===============================
   DELETE NOTIFICATION
============================== */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    await prisma.notification.delete({ where: { id } });

    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("DELETE NOTIFICATION ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
});

module.exports = router;
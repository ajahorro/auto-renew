const prisma = require("../config/prisma");

/* GET NOTIFICATIONS */

const getNotifications = async (req, res) => {

  try {

const userId = String(req.user.id);
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

const notifications = await prisma.notification.findMany({
  where: {
    userId: userId
  },
  orderBy: {
    createdAt: "desc"
  }
});

    res.json({
      notifications
    });

  } catch (error) {

    console.error("GET NOTIFICATIONS ERROR:", error);

    res.status(500).json({
      message: "Internal server error"
    });

  }

};


/* MARK ONE NOTIFICATION READ */

const markNotificationRead = async (req, res) => {

  try {

    const id = Number(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid notification id"
      });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: id,
        userId: userId
      }
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found"
      });
    }

    const updated = await prisma.notification.update({
      where: {
        id: id
      },
      data: {
        isRead: true
      }
    });

    res.json(updated);

  } catch (error) {

    console.error("MARK READ ERROR:", error);

    res.status(500).json({
      message: "Internal server error"
    });

  }

};


/* MARK ALL NOTIFICATIONS READ */

const markAllNotificationsRead = async (req, res) => {

  try {

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    await prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    res.json({
      success: true,
      message: "All notifications marked as read"
    });

  } catch (error) {

    console.error("MARK ALL READ ERROR:", error);

    res.status(500).json({
      message: "Internal server error"
    });

  }

};


/* CLEAR NOTIFICATIONS (OPTIONAL ADMIN FUTURE FEATURE) */

const clearAllNotifications = async (req, res) => {

  try {

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    await prisma.notification.deleteMany({
      where: {
        userId: userId
      }
    });

    res.json({
      message: "Notifications cleared"
    });

  } catch (error) {

    console.error("CLEAR NOTIFICATIONS ERROR:", error);

    res.status(500).json({
      message: "Internal server error"
    });

  }

};


module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications
};

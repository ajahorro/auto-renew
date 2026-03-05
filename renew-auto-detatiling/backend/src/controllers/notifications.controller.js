const prisma = require("../config/prisma");

const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" }
    });

    res.json(notifications);

  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json(notification);

  } catch (error) {
    console.error("MARK READ ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getNotifications,
  markNotificationRead
};
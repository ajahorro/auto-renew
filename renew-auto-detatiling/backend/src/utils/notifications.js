const prisma = require("../config/prisma");

const sendNotification = async ({ userId, title, message, type, actionType, actorId, actorName, targetId, targetName, tx }) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notifyEmail: true, notifyWeb: true }
    });

    const shouldNotify = user?.notifyWeb !== false;

    if (!shouldNotify && !user?.notifyEmail) {
      return null;
    }

    const db = tx || prisma;
    
    const notification = await db.notification.create({
      data: {
        userId,
        title,
        message,
        type: type || "SYSTEM",
        actionType: actionType || null,
        actorId: actorId || null,
        actorName: actorName || null,
        targetId: targetId || null,
        targetName: targetName || null
      }
    });

    return notification;
  } catch (error) {
    console.error("Notification failed:", error.message);
    return null;
  }
};

const notifyUser = async (userId, data, tx = null) => {
  return sendNotification({ userId, ...data, tx });
};

const notifyMultiple = async (userIds, data, tx = null) => {
  const results = [];
  for (const userId of userIds) {
    const result = await sendNotification({ userId, ...data, tx });
    results.push(result);
  }
  return results;
};

module.exports = {
  sendNotification,
  notifyUser,
  notifyMultiple
};
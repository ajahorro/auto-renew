const prisma = require("../config/prisma");
const { sendEmail } = require("./email.service");

/**
 * Centralised notification service.
 *
 * Every controller imports from here instead of defining its own
 * createNotification / notifyAdmins helpers.
 *
 * Handles:
 *  - User preference checks (notifyWeb / notifyEmail)
 *  - In-app notification creation
 *  - Email dispatch (non-blocking, fire-and-forget)
 */

/**
 * Create a notification for a single user.
 * Respects the user's notifyWeb / notifyEmail preferences.
 *
 * @param {string}  userId
 * @param {object}  data          - { title, message, type, actionType, actorId, actorName, targetId, targetName }
 * @param {object}  [tx]          - Optional Prisma transaction client
 * @returns {Promise<object|null>} The created notification, or null if skipped
 */
async function createNotification(userId, data, tx) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, notifyEmail: true, notifyWeb: true }
    });

    if (!user) return null;

    const hasWeb = user.notifyWeb !== false;
    const hasEmail = user.notifyEmail !== false;

    if (!hasWeb && !hasEmail) return null;

    const db = tx || prisma;

    const inAppNotification = hasWeb
      ? await db.notification.create({
          data: {
            userId,
            title: data.title,
            message: data.message,
            type: data.type || "GENERAL",
            actionType: data.actionType || null,
            actorId: data.actorId || null,
            actorName: data.actorName || null,
            targetId: data.targetId || null,
            targetName: data.targetName || null
          }
        })
      : null;

    if (hasEmail && user.email) {
      const emailSubject = `[RENEW Auto Detailing] ${data.title}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">${data.title}</h2>
          <p style="color: #374151; font-size: 16px;">${data.message}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            Log in to your account for more details.
          </p>
        </div>
      `;

      sendEmail(user.email, emailSubject, emailHtml).catch(err => {
        console.error("Email send failed:", err.message);
      });
    }

    return inAppNotification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}

/**
 * Notify all active admins (ADMIN + SUPER_ADMIN).
 *
 * @param {object} data - Notification data (same shape as createNotification)
 * @param {object} [tx] - Optional Prisma transaction client
 */
async function notifyAdmins(data, tx) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    for (const admin of admins) {
      await createNotification(admin.id, data, tx);
    }
  } catch (error) {
    console.error("Failed to notify admins:", error);
  }
}

/**
 * Convenience wrapper: notify admins about a booking event.
 *
 * @param {number} bookingId
 * @param {string} title
 * @param {string} message
 * @param {string} [actorId]
 * @param {string} [actorName]
 */
async function notifyAdminsBookingUpdated(bookingId, title, message, actorId, actorName) {
  await notifyAdmins({
    title,
    message,
    type: "BOOKING",
    actionType: "BOOKING_UPDATED",
    actorId: actorId || null,
    actorName: actorName || null,
    targetId: String(bookingId),
    targetName: `Booking #${bookingId}`
  });
}

module.exports = {
  createNotification,
  notifyAdmins,
  notifyAdminsBookingUpdated
};
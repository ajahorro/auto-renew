const prisma = require("../config/prisma");
const { sendEmail } = require("../services/email.service");

const createNotification = async (userId, data) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, notifyEmail: true, notifyWeb: true }
    });

    if (!user) return null;
    const hasWeb = user.notifyWeb !== false;
    const hasEmail = user.notifyEmail !== false;
    if (!hasWeb && !hasEmail) return null;

    if (hasWeb) {
      await prisma.notification.create({
        data: { userId, title: data.title, message: data.message, type: data.type || "GENERAL", actionType: data.actionType, actorId: data.actorId, actorName: data.actorName, targetId: data.targetId, targetName: data.targetName }
      });
    }

    if (hasEmail && user.email) {
      sendEmail(user.email, `[RENEW] ${data.title}`, `<div style="font-family: Arial;"><h2>${data.title}</h2><p>${data.message}</p></div>`).catch(() => {});
    }
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

const SEND_MESSAGE = async (req, res) => {
  try {
    const { bookingId, message, attachment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: { customer: true }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const senderRole = ["ADMIN", "SUPER_ADMIN"].includes(userRole) ? "ADMIN" : "CUSTOMER";

    const actor = await prisma.user.findUnique({ where: { id: userId } });

    const communicationLog = await prisma.$transaction(async (tx) => {
      const log = await tx.communicationLog.create({
        data: {
          bookingId: booking.id,
          senderId: userId,
          senderRole,
          message: message.trim(),
          attachment: attachment || null
        }
      });

      if (senderRole === "ADMIN") {
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            title: "New Message",
            message: `You have a new message regarding Booking #${booking.id}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
            type: "COMMUNICATION",
            actionType: "MESSAGE_RECEIVED",
            actorId: userId,
            actorName: actor?.fullName || "Admin",
            targetId: String(booking.id),
            targetName: `Booking #${booking.id}`
          }
        });
      } else {
        const admins = await tx.user.findMany({
          where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
        });
        
        for (const admin of admins) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              title: "New Message from Customer",
              message: `${booking.customer?.fullName || "Customer"} sent a message regarding Booking #${booking.id}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
              type: "COMMUNICATION",
              actionType: "MESSAGE_RECEIVED",
              actorId: userId,
              actorName: actor?.fullName || "Customer",
              targetId: String(booking.id),
              targetName: `Booking #${booking.id}`
            }
          });
        }
      }

      return log;
    });

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      communication: communicationLog
    });

  } catch (error) {
    console.error("SEND MESSAGE ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send message"
    });
  }
};

const GET_MESSAGES = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (userRole === "CUSTOMER" && booking.customerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only view messages for your own bookings"
      });
    }

    const communications = await prisma.communicationLog.findMany({
      where: { bookingId: Number(bookingId) },
      include: {
        sender: { select: { id: true, fullName: true, role: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      success: true,
      communications
    });

  } catch (error) {
    console.error("GET MESSAGES ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages"
    });
  }
};

const DELETE_MESSAGE = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const message = await prisma.communicationLog.findUnique({
      where: { id: Number(id) }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.senderId !== userId && !["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own messages"
      });
    }

    await prisma.communicationLog.delete({
      where: { id: Number(id) }
    });

    res.json({
      success: true,
      message: "Message deleted successfully"
    });

  } catch (error) {
    console.error("DELETE MESSAGE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete message"
    });
  }
};

module.exports = {
  SEND_MESSAGE,
  GET_MESSAGES,
  DELETE_MESSAGE
};

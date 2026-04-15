const prisma = require("../config/prisma");

const createNotification = async (userId, data) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type || "SETTINGS",
        actionType: data.actionType,
        actorId: data.actorId,
        actorName: data.actorName,
        targetId: data.targetId,
        targetName: data.targetName
      }
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

const notifyAdmins = async (title, message, actionType, actorId = null, actorName = "System") => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    
    for (const admin of admins) {
      await createNotification(admin.id, {
        title,
        message,
        type: "SETTINGS",
        actionType,
        actorId,
        actorName,
        targetId: "business-settings",
        targetName: "Business Settings"
      });
    }
  } catch (error) {
    console.error("Failed to notify admins:", error);
  }
};

/* GET BUSINESS SETTINGS */
const getBusinessSettings = async (req, res) => {
  try {
    const settings = await prisma.businessSettings.findFirst();
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Business settings not found"
      });
    }

    res.json({
      success: true,
      settings,
      maxServicesPerBooking: settings.maxServicesPerBooking
    });

  } catch (error) {
    console.error("GET SETTINGS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings"
    });
  }
};

/* UPDATE BUSINESS SETTINGS */
const updateBusinessSettings = async (req, res) => {
  try {
    const {
      openingHour,
      closingHour,
      slotDurationMinutes,
      maxBookingsPerSlot,
      maxServicesPerBooking
    } = req.body;

    const existing = await prisma.businessSettings.findFirst();
    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    if (existing) {
      await prisma.businessSettings.update({
        where: { id: existing.id },
        data: {
          openingHour,
          closingHour,
          slotDurationMinutes,
          maxBookingsPerSlot,
          maxServicesPerBooking
        }
      });
    } else {
      await prisma.businessSettings.create({
        data: {
          openingHour,
          closingHour,
          slotDurationMinutes,
          maxBookingsPerSlot,
          maxServicesPerBooking
        }
      });
    }

    await notifyAdmins(
      "Business Settings Updated",
      `Settings were updated by ${actor?.fullName || "Admin"}.`,
      "SETTINGS_UPDATED",
      req.user?.id,
      actor?.fullName || "Admin"
    );

    res.json({
      success: true,
      message: "Settings updated successfully"
    });

  } catch (error) {
    console.error("UPDATE SETTINGS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update settings"
    });
  }
};

module.exports = {
  getBusinessSettings,
  updateBusinessSettings
};

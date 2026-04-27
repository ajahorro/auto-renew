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
        data: { userId, title: data.title, message: data.message, type: data.type || "SETTINGS", actionType: data.actionType, actorId: data.actorId, actorName: data.actorName, targetId: data.targetId, targetName: data.targetName }
      });
    }

    if (hasEmail && user.email) {
      sendEmail(user.email, `[RENEW] ${data.title}`, `<div style="font-family: Arial;"><h2>${data.title}</h2><p>${data.message}</p></div>`).catch(() => {});
    }
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

/* HELPER: Convert Decimal fields to strings for JSON serialization */
const serializeSettings = (settings) => {
  if (!settings) return null;
  
  const serialized = { ...settings };
  
  // Convert Decimal fields to strings
  const decimalFields = [
    'downpaymentThreshold',
    'downpaymentPercentage'
  ];
  
  decimalFields.forEach(field => {
    if (serialized[field] !== null && serialized[field] !== undefined) {
      serialized[field] = serialized[field].toString();
    }
  });
  
  return serialized;
};

/* GET BUSINESS SETTINGS */
const getBusinessSettings = async (req, res) => {
  try {
    let settings = await prisma.businessSettings.findFirst();
    
    // If no settings found, create default ones
    if (!settings) {
      console.log("[INFO] No business settings found. Creating defaults...");
      
      try {
        settings = await prisma.businessSettings.create({
          data: {
            id: 1,
            slotDurationMinutes: 60,
            openingHour: 9,
            closingHour: 18,
            maxBookingsPerSlot: 3,
            maxServicesPerBooking: 5,
            cancellationWindowHours: 24,
            paymentGracePeriodHours: 24,
            pendingCleanupHours: 24,
            startReminderDelayMinutes: 5,
            notificationRetryLimit: 3
          }
        });
        console.log("[INFO] Default business settings created successfully");
      } catch (createError) {
        console.error("[ERROR] Failed to create default settings:", createError.message);
        // Return defaults as fallback
        const defaultSettings = {
          id: 1,
          openingHour: 9,
          closingHour: 18,
          slotDurationMinutes: 60,
          maxBookingsPerSlot: 3,
          maxServicesPerBooking: 5,
          downpaymentThreshold: "5000.00",
          downpaymentPercentage: "0.50",
          cancellationWindowHours: 24,
          gcashNumber: null,
          gcashName: null
        
        return res.json({
          success: true,
          settings: defaultSettings,
          maxServicesPerBooking: defaultSettings.maxServicesPerBooking
        });
      }
    }

    // Serialize the response to handle Decimal fields
    const serializedSettings = serializeSettings(settings);

    res.json({
      success: true,
      settings: serializedSettings,
      maxServicesPerBooking: serializedSettings.maxServicesPerBooking
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

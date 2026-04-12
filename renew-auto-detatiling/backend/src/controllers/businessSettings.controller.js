const prisma = require("../config/prisma");

/* GET BUSINESS SETTINGS */

const getSettings = async (req, res) => {

  try {

    const settings = await prisma.businessSettings.findFirst();

    if (!settings) {
      return res.status(404).json({
        message: "Business settings not found"
      });
    }

    res.json(settings);

  } catch (error) {

    console.error("GET SETTINGS ERROR:", error);

    res.status(500).json({
      message: "Failed to load business settings"
    });

  }

};


/* UPDATE BUSINESS SETTINGS */

const updateSettings = async (req, res) => {

  try {

    const {
      openingHour,
      closingHour,
      slotDurationMinutes,
      maxBookingsPerSlot,
      maxServicesPerBooking
    } = req.body;

    const updated = await prisma.businessSettings.update({
      where: { id: 1 },
      data: {
        openingHour: Number(openingHour),
        closingHour: Number(closingHour),
        slotDurationMinutes: Number(slotDurationMinutes),
        maxBookingsPerSlot: Number(maxBookingsPerSlot),
        maxServicesPerBooking: maxServicesPerBooking !== undefined ? Number(maxServicesPerBooking) : 5
      }
    });

    res.json(updated);

  } catch (error) {

    console.error("UPDATE SETTINGS ERROR:", error);

    res.status(500).json({
      message: "Failed to update business settings"
    });

  }

};


module.exports = {
  getSettings,
  updateSettings
};
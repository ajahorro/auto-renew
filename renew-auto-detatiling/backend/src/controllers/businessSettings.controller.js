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
      maxServicesPerBooking,
      gcashNumber,
      gcashName,
      downpaymentThreshold,
      downpaymentPercentage,
      cancellationWindowHours
    } = req.body;

    const updated = await prisma.businessSettings.update({
      where: { id: 1 },
      data: {
        openingHour: openingHour !== undefined ? Number(openingHour) : undefined,
        closingHour: closingHour !== undefined ? Number(closingHour) : undefined,
        slotDurationMinutes: slotDurationMinutes !== undefined ? Number(slotDurationMinutes) : undefined,
        maxBookingsPerSlot: maxBookingsPerSlot !== undefined ? Number(maxBookingsPerSlot) : undefined,
        maxServicesPerBooking: maxServicesPerBooking !== undefined ? Number(maxServicesPerBooking) : undefined,
        gcashNumber: gcashNumber !== undefined ? gcashNumber : undefined,
        gcashName: gcashName !== undefined ? gcashName : undefined,
        downpaymentThreshold: downpaymentThreshold !== undefined ? Number(downpaymentThreshold) : undefined,
        downpaymentPercentage: downpaymentPercentage !== undefined ? Number(downpaymentPercentage) : undefined,
        cancellationWindowHours: cancellationWindowHours !== undefined ? Number(cancellationWindowHours) : undefined
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

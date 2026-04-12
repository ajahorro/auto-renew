const prisma = require("./prisma");

/* ENSURE BUSINESS SETTINGS EXIST */

async function ensureBusinessSettings() {

  try {

    const existing = await prisma.businessSettings.findFirst();

    if (!existing) {

      await prisma.businessSettings.create({
        data: {
          id: 1,
          slotDurationMinutes: 60,
          openingHour: 9,
          closingHour: 18,
          maxBookingsPerSlot: 3,
          maxServicesPerBooking: 5
        }
      });

      console.log("Default business settings created");

    }

  } catch (error) {

    console.error("Failed to ensure business settings:", error);

  }

}

module.exports = ensureBusinessSettings;
const prisma = require("../config/prisma");

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

const getSettings = async (req, res) => {

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
            cancellationWindowHours: 24
          }
        });
        console.log("[INFO] Default business settings created successfully");
      } catch (createError) {
        // Settings might already exist but query failed, return defaults
        console.error("[ERROR] Failed to create default settings:", createError.message);
        return res.status(200).json({
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
        });
      }
    }

    // Serialize the response to handle Decimal fields
    const serializedSettings = serializeSettings(settings);

    res.json(serializedSettings);

  } catch (error) {
    console.error("GET_BUSINESS_SETTINGS_ERROR:", error.message, error.stack);
    
    // Return default settings as fallback
    console.warn("[WARN] Returning default settings due to database error");
    res.status(200).json({
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

    const data = {
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
    };

    if (req.file) {
      data.gcashQR = `/uploads/${req.file.filename}`;
    }

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || Number.isNaN(data[key])) {
        delete data[key];
      }
    });

    const updated = await prisma.businessSettings.update({
      where: { id: 1 },
      data
    });

    // Serialize the response to handle Decimal fields
    const serializedSettings = serializeSettings(updated);

    res.json(serializedSettings);

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

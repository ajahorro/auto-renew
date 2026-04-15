const prisma = require("../config/prisma");

// Helper to notify users with full context
const createNotification = async (userId, data) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type || "GENERAL",
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

// Helper to notify all admins about booking updates
const notifyAdminsBookingUpdated = async (bookingId, action, details = "", actorId = null, actorName = "System") => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    
    for (const admin of admins) {
      await createNotification(admin.id, {
        title: `Booking ${action}`,
        message: `Booking #${bookingId}: ${details}`,
        type: "BOOKING",
        actionType: action.toUpperCase().replace(" ", "_"),
        actorId,
        actorName,
        targetId: String(bookingId),
        targetName: `Booking #${bookingId}`
      });
    }
  } catch (error) {
    console.error("Failed to notify admins:", error);
  }
};

const parseBookingId = (req) => {
  const rawId = req.params.id || req.params.bookingId || req.body.id || req.query.id;
  const id = Number(rawId);
  return Number.isInteger(id) ? id : null;
};
// STATUS CONSTANTS (must match Prisma enum BookingStatus)
const STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  PENDING_PAYMENT: "pending_payment",
  PARTIALLY_PAID: "partially_paid",
  CONFIRMED: "confirmed",
  SCHEDULED: "scheduled",
  ONGOING: "ongoing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  CANCEL_REQUESTED: "cancel_requested"
};

// VALID TRANSITIONS
function isValidTransition(current, next) {
  const map = {
    draft: ["pending", "cancelled"],
    pending: ["pending_payment", "scheduled", "cancelled"],
    pending_payment: ["partially_paid", "cancelled"],
    partially_paid: ["confirmed", "cancelled"],
    confirmed: ["scheduled", "cancelled"],
    scheduled: ["ongoing", "cancelled"],
    ongoing: ["completed"],
    completed: [],
    cancelled: [],
    cancel_requested: ["cancelled"]
  };

  return map[current]?.includes(next);
}

/* HELPERS */
// FIX: 
// function parseBookingId(req) {
//   const id = Number(req.params.id);
//   return Number.isInteger(id) ? id : null;
// }

function calculateDownpayment(total) {
  // If exactly 5000, require 2500 downpayment
  if (total === 5000) return 2500;
  // If under 5000, no downpayment
  if (total < 5000) return 0;
  // If between 5001 and 6000, 3500 downpayment
  if (total <= 6000) return 3500;
  // Above 6000, 5000 downpayment
  return 5000;
}
/* HELPERS CONTINUED */

function calculateTotalDuration(services) {
  if (!Array.isArray(services)) return 0;
  let total = 0;
  services.forEach(service => {
    // Ensure we are accessing durationMin correctly from the service object
    total += service.durationMin || 0;
  });
  return total;
}

function isPrivilegedRole(role) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function getUpdatedPaymentState(booking, paymentAmount) {
  const currentPaid = Number(booking.amountPaid) || 0;
  const totalAmount = Number(booking.totalAmount) || 0;
  const newAmountPaid = currentPaid + paymentAmount;

  let paymentStatus = "PARTIALLY_PAID";
  if (newAmountPaid <= 0) {
    paymentStatus = "UNPAID";
  } else if (newAmountPaid >= totalAmount) {
    paymentStatus = "PAID";
  }

  const downpaymentAmount = Number(booking.downpaymentAmount) || 0;
  const downpaymentSatisfied =
    !booking.downpaymentRequested || downpaymentAmount <= 0 || newAmountPaid >= downpaymentAmount;

  const nextStatus =
    booking.status === STATUS.PENDING && downpaymentSatisfied
      ? STATUS.SCHEDULED
      : booking.status;

  return {
    newAmountPaid,
    paymentStatus,
    nextStatus,
    downpaymentSatisfied
  };
}
// FIX: 
// async function updateBookingStates() {
//   try {
//     const now = new Date();

//     // 1. Mark SCHEDULED as ONGOING if the start time has passed
//     await prisma.booking.updateMany({
//       where: {
//         status: STATUS.SCHEDULED,
//         appointmentStart: {
//           lte: now
//         }
//       },
//       data: {
//         status: STATUS.ONGOING
//       }
//     });

//     // 2. Mark ONGOING as COMPLETED if the end time has passed
//     await prisma.booking.updateMany({
//       where: {
//         status: STATUS.ONGOING,
//         appointmentEnd: {
//           lte: now
//         }
//       },
//       data: {
//         status: STATUS.COMPLETED
//       }
//     });
    
//     // 3. Mark PENDING as CANCELLED if start time passed without scheduling
//     await prisma.booking.updateMany({
//       where: {
//         status: STATUS.PENDING,
//         appointmentStart: {
//           lt: now
//         }
//       },
//       data: {
//         status: STATUS.CANCELLED
//       }
//     });
//   } catch (error) {
//     // Log the error but don't throw, so the main dashboard can still load
//     console.error("Background state update failed:", error);
//   }
// }
/* CREATE BOOKING */
const createBooking = async (req, res) => {
  try {
    // Ensure userId is treated as a String to match Schema CUID
    const userId = req.user?.id ? String(req.user.id) : null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user token"
      });
    }

    const {
      services,
      appointmentStart,
      notes,
      vehicleType,
      plateNumber,
      contactNumber,
      email,
      vehicleBrand,
      vehicleModel
    } = req.body;

    if (!services || services.length === 0 || !appointmentStart) {
      return res.status(400).json({
        success: false,
        message: "services and appointmentStart required"
      });
    }

    let start = new Date(appointmentStart);
    /* CLEAN TIMESTAMP */
    start.setSeconds(0);
    start.setMilliseconds(0);

    console.log("📅 BOOKING DEBUG:", {
      received: appointmentStart,
      parsed: start.toISOString(),
      hour: start.getHours(),
      date: start.toDateString()
    });

    /* Use simple time comparison (no timezone offset) */
    const now = new Date();
    
    /* PREVENT BOOKING IN PAST */
    const isToday = start.toDateString() === now.toDateString();
    
    // For same day: allow if time hasn't passed
    // For future: allow if date is in future
    if (isToday && start.getTime() <= now.getTime()) {
      return res.status(400).json({
        success: false,
        message: isToday ? "Cannot book in the past" : "Cannot create booking in the past"
      });
    }
    if (!isToday && start < now) {
      return res.status(400).json({
        success: false,
        message: "Cannot create booking in the past"
      });
    }

    /* MINIMUM NOTICE (15 MINUTES) - Same day bookings get faster processing */
    const minimumNoticeMinutes = isToday ? 15 : 30;
    const minStart = new Date(now.getTime() + minimumNoticeMinutes * 60000);
    if (start < minStart) {
      return res.status(400).json({
        success: false,
        message: `Bookings must be made at least ${minimumNoticeMinutes} minutes in advance`
      });
    }

    /* MAX BOOKING WINDOW (60 DAYS) */
    const maxAdvanceDays = 60;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

    if (start > maxDate) {
      return res.status(400).json({
        success: false,
        message: "Bookings cannot be made more than 60 days in advance"
      });
    }

    /* LOAD BUSINESS SETTINGS */
    let settings = await prisma.businessSettings.findFirst();
    const defaults = { openingHour: 9, closingHour: 18, maxBookingsPerSlot: 3, maxServicesPerBooking: 5 };

    const openingHour = settings?.openingHour ?? defaults.openingHour;
    const closingHour = settings?.closingHour ?? defaults.closingHour;
    const maxBookingsPerSlot = settings?.maxBookingsPerSlot ?? defaults.maxBookingsPerSlot;
    const maxServicesPerBooking = settings?.maxServicesPerBooking ?? defaults.maxServicesPerBooking;
    
    console.log("🕐 BUSINESS HOURS DEBUG:", { openingHour, closingHour, startHour: start.getHours() });
    
    // Simply check if start hour is within range (no timezone complexity)
    const startHour = start.getHours();
    console.log("✅ Hour check:", { startHour, openingHour, closingHour, allowed: startHour >= openingHour && startHour <= closingHour });
    
    /* ALLOW BOOKINGS THAT PARTIALLY EXTEND PAST CLOSING */
    // Only check end time for future bookings
    if (!isToday) {
      // For future bookings, allow some flexibility
      const end = new Date(start.getTime() + totalDuration * 60000);
      const closingDateTime = new Date(start);
      closingDateTime.setHours(closingHour + 1, 0, 0, 0); // Allow 1 hour buffer past closing
      
      if (end > closingDateTime) {
        return res.status(400).json({
          success: false,
          message: "Service duration extends too far past closing time"
        });
      }
    }

    /* CONVERT SERVICE IDS */
    const serviceIds = services.map(Number).filter(n => !isNaN(n));
    if (serviceIds.length !== services.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid service IDs"
      });
    }

    /* CHECK SERVICE LIMIT */
    if (serviceIds.length > maxServicesPerBooking) {
      return res.status(400).json({
        success: false,
        message: `You can only select up to ${maxServicesPerBooking} services per booking`
      });
    }

    const dbServices = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        isActive: true
      }
    });

    /* VALIDATE SERVICES */
    if (dbServices.length === 0 || dbServices.length !== serviceIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more services are invalid or inactive"
      });
    }

    /* CALCULATE TOTAL DURATION */
    const totalDuration = calculateTotalDuration(dbServices);
    if (totalDuration <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid service duration"
      });
    }

    const end = new Date(start.getTime() + totalDuration * 60000);

    // Allow bookings that end up to 1 hour past closing (typical service takes 1-2 hours)
    const closingTime = new Date(start);
    closingTime.setHours(closingHour + 1, 0, 0, 0);

    if (end > closingTime) {
      return res.status(400).json({
        success: false,
        message: "Service would extend too far past closing time"
      });
    }

    /* PREVENT CUSTOMER DOUBLE BOOKING */
    const customerConflict = await prisma.booking.findFirst({
      where: {
        customerId: userId,
        status: { in: [STATUS.PENDING, STATUS.SCHEDULED, STATUS.ONGOING] },
        appointmentStart: { lt: end },
        appointmentEnd: { gt: start }
      }
    });

    if (customerConflict) {
      return res.status(400).json({
        success: false,
        message: "You already have a booking during this time"
      });
    }
    
    /* PREVENT SLOT OVERBOOKING */
    const overlappingBookings = await prisma.booking.count({
      where: {
        appointmentStart: { lt: end },
        appointmentEnd: { gt: start },
        status: { not: STATUS.CANCELLED }
      }
    });

    if (overlappingBookings + 1 > maxBookingsPerSlot) {
      return res.status(400).json({
        success: false,
        message: "Selected time slot is fully booked"
      });
    }

    /* PREPARE BOOKING ITEMS */
    let totalAmount = 0;
    const items = dbServices.map(service => {
      const price = Number(service.price);
      totalAmount += price;
      return {
        serviceId: service.id,
        serviceNameAtBooking: service.name,
        priceAtBooking: price,
        durationAtBooking: service.durationMin,
        quantity: 1
      };
    });

    /* PAYMENT RULES */
    let downpaymentRequired = 0;

    if (totalAmount <= 5000) {
      downpaymentRequired = 0;
    } else if (totalAmount <= 6000) {
      downpaymentRequired = 3500;
    } else {
      downpaymentRequired = 5000;
    }

    const bookingStatus =
      downpaymentRequired > 0 ? STATUS.PENDING : STATUS.SCHEDULED;

    const customer = await prisma.user.findUnique({ where: { id: userId } });

    /* WRAP IN TRANSACTION */
    const result = await prisma.$transaction(async (tx) => {
      // Race Condition Protection
      const currentOverlapCount = await tx.booking.count({
        where: {
          appointmentStart: { lt: end },
          appointmentEnd: { gt: start },
          status: { not: STATUS.CANCELLED }
        }
      });

      if (currentOverlapCount + 1 > maxBookingsPerSlot) {
        throw new Error("This slot just filled up. Please select a different time.");
      }

      const newBooking = await tx.booking.create({
        data: {
          customerId: userId,
          vehicleType,
          plateNumber,
          contactNumber,
          email: customer?.email,
          vehicleBrand,
          vehicleModel,
          notes,
          status: bookingStatus,
          appointmentStart: start,
          appointmentEnd: end,
          totalAmount,
          paymentStatus: "UNPAID",
          amountPaid: 0,
          paymentMethod: "CASH",
          downpaymentRequested: downpaymentRequired > 0,
          downpaymentAmount: downpaymentRequired > 0 ? downpaymentRequired : null,
          items: {
            create: items.map(item => ({
              serviceId: item.serviceId,
              serviceNameAtBooking: item.serviceNameAtBooking,
              priceAtBooking: item.priceAtBooking,
              durationAtBooking: item.durationAtBooking,
              quantity: item.quantity
            }))
          }
        },
        include: { items: true }
      });

      // Notify customer
      await tx.notification.create({
        data: {
          userId: userId,
          title: bookingStatus === STATUS.SCHEDULED ? "Booking Confirmed" : "Booking Received",
          message: bookingStatus === STATUS.SCHEDULED 
            ? `Your appointment on ${start.toLocaleDateString()} is confirmed.`
            : `Your booking request for ${start.toLocaleDateString()} is pending review.`,
          type: "BOOKING",
          actionType: "CREATED_BOOKING",
          actorId: userId,
          actorName: customer?.fullName || "Customer",
          targetId: String(newBooking.id),
          targetName: `Booking #${newBooking.id}`
        }
      });

      // Notify admins
      await notifyAdminsBookingUpdated(newBooking.id, "Created", `New booking from ${customer?.fullName || "Customer"}. Total: ₱${totalAmount.toLocaleString()}`, userId, customer?.fullName);

      if (downpaymentRequired > 0) {
        await tx.notification.create({
          data: {
            userId: userId,
            title: "Downpayment Required",
            message: `Total: ₱${totalAmount.toLocaleString()}. Downpayment of ₱${downpaymentRequired.toLocaleString()} required.`,
            type: "PAYMENT"
          }
        });
      }

      return newBooking;
    });

    res.status(201).json({
      success: true,
      booking: result,
      downpaymentRequired
    });

  } catch (error) {
    console.error("🔥 CREATE BOOKING ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};
/* CANCEL BOOKING */
const cancelBooking = async (req, res) => {
  try {
    const id = parseBookingId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking id"
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Only admins can directly cancel bookings
    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can cancel bookings. Customers must request cancellation."
      });
    }

    if (
      booking.status !== STATUS.PENDING &&
      booking.status !== STATUS.SCHEDULED
    ) {
      return res.status(400).json({
        success: false,
        message: "Only pending or scheduled bookings can be cancelled"
      });
    }

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { status: STATUS.CANCELLED }
      });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Booking Cancelled",
          message: `Your booking on ${new Date(booking.appointmentStart).toLocaleString()} has been cancelled.`,
          type: "BOOKING",
          actionType: "CANCELLED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });

      if (booking.assignedStaffId) {
        await tx.notification.create({
          data: {
            userId: booking.assignedStaffId,
            title: "Booking Cancelled",
            message: `Booking #${id} has been cancelled.`,
            type: "BOOKING",
            actionType: "CANCELLED",
            actorId: req.user?.id || null,
            actorName: actor?.fullName || "Admin",
            targetId: String(id),
            targetName: `Booking #${id}`
          }
        });
      }

      return updatedBooking;
    });

    res.json({
      success: true,
      booking: result
    });

  } catch (error) {
    console.error("CANCEL BOOKING ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel booking"
    });
  }
};
/* ASSIGN STAFF (SMART ASSIGNMENT) */
const assignStaff = async (req, res) => {
  try {
    const id = parseBookingId(req);
    let { assignedStaffId } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // prevent modification if locked
    if (booking.status === STATUS.COMPLETED || booking.status === STATUS.CANCELLED) {
      return res.status(400).json({ success: false, message: "Booking is locked" });
    }

    // Allow assignment for PENDING, SCHEDULED, and ONGOING bookings
    if (![STATUS.PENDING, STATUS.SCHEDULED, STATUS.ONGOING].includes(booking.status)) {
      return res.status(400).json({ success: false, message: "Staff can only be assigned to pending, scheduled, or ongoing bookings" });
    }

    if (
      booking.status === STATUS.PENDING &&
      booking.downpaymentRequested &&
      (Number(booking.amountPaid) || 0) < (Number(booking.downpaymentAmount) || 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Downpayment must be verified before assigning staff"
      });
    }

    // Only check time constraint for future bookings
    if (booking.status !== STATUS.ONGOING && new Date() >= booking.appointmentStart) {
      return res.status(400).json({ success: false, message: "Cannot assign staff after start" });
    }

    /* =================================
    DETERMINE STAFF ID (MANUAL OR AUTO)
    =================================
    */
    if (assignedStaffId) {
      // Ensure the ID is a string for the query
      const staff = await prisma.user.findUnique({ where: { id: String(assignedStaffId) } });
      if (!staff || staff.role !== "STAFF" || !staff.active) {
        return res.status(400).json({ success: false, message: "Invalid or inactive staff" });
      }

      const conflict = await prisma.booking.findFirst({
        where: {
          assignedStaffId: String(assignedStaffId),
          id: { not: id },
          status: { in: [STATUS.PENDING, STATUS.SCHEDULED, STATUS.ONGOING] },
          appointmentStart: { lt: booking.appointmentEnd },
          appointmentEnd: { gt: booking.appointmentStart }
        }
      });

      if (conflict) {
        return res.status(400).json({ success: false, message: "Staff busy during this time" });
      }
    } else {
      const staffList = await prisma.user.findMany({ where: { role: "STAFF", isActive: true } });
      let availableStaff = [];

      for (const staff of staffList) {
        const conflict = await prisma.booking.findFirst({
          where: {
            assignedStaffId: staff.id,
            id: { not: id },
            status: { in: [STATUS.PENDING, STATUS.SCHEDULED, STATUS.ONGOING] },
            appointmentStart: { lt: booking.appointmentEnd },
            appointmentEnd: { gt: booking.appointmentStart }
          }
        });

        if (!conflict) {
          const workload = await prisma.booking.count({
            where: {
              assignedStaffId: staff.id,
              status: { in: [STATUS.PENDING, STATUS.SCHEDULED, STATUS.ONGOING] }
            }
          });
          availableStaff.push({ staff, workload });
        }
      }

      if (availableStaff.length === 0) {
        return res.status(400).json({ success: false, message: "No available staff" });
      }

      availableStaff.sort((a, b) => a.workload - b.workload);
      assignedStaffId = availableStaff[0].staff.id;
    }
    /* =================================
    UPDATE DATABASE & NOTIFY
    =================================
    */
    const previousStaffId = booking.assignedStaffId;
    const isReassignment = previousStaffId && previousStaffId !== String(assignedStaffId);

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        // Ensure assignedStaffId is cast to String
        data: { 
          assignedStaffId: String(assignedStaffId),
          status: booking.status === STATUS.PENDING ? STATUS.SCHEDULED : booking.status
        },
        include: { assignedStaff: { select: { fullName: true } }, customer: { select: { fullName: true } } }
      });

      const actor = await tx.user.findUnique({ where: { id: req.user?.id } });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: isReassignment ? "Staff Reassigned" : "Staff Assigned",
          message: isReassignment 
            ? `${updatedBooking.assignedStaff.fullName} has been reassigned to your service.`
            : `${updatedBooking.assignedStaff.fullName} has been assigned to your service.`,
          type: "BOOKING",
          actionType: isReassignment ? "REASSIGNED" : "STAFF_ASSIGNED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });

      await tx.notification.create({
        data: {
          userId: String(assignedStaffId),
          title: isReassignment ? "Booking Reassigned" : "New Task Assigned",
          message: isReassignment
            ? `You have been reassigned to booking #${id}.`
            : `You have been assigned to a new booking (ID: ${id}).`,
          type: "BOOKING",
          actionType: isReassignment ? "REASSIGNED" : "STAFF_ASSIGNED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });

      if (isReassignment && previousStaffId) {
        await tx.notification.create({
          data: {
            userId: String(previousStaffId),
            title: "Booking Unassigned",
            message: `You have been unassigned from booking #${id}.`,
            type: "BOOKING",
            actionType: "UNASSIGNED",
            actorId: req.user?.id || null,
            actorName: actor?.fullName || "Admin",
            targetId: String(id),
            targetName: `Booking #${id}`
          }
        });
      }

      return updatedBooking;
    });

    return res.json({ 
      success: true, 
      message: "Staff assigned successfully", 
      booking: result 
    });

  } catch (error) {
    console.error("ASSIGN STAFF ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to assign staff" });
  }
};

/* UPDATE BOOKING STATUS */

const updateBookingStatus = async (req, res) => {
  try {
    const id = parseBookingId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking id"
      });
    }

    const { status } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const actorRole = String(req.user.role || "").toUpperCase();

    // Check if locked
    if (
      booking.status === STATUS.COMPLETED ||
      booking.status === STATUS.CANCELLED
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify completed or cancelled booking"
      });
    }

    // Cannot cancel ongoing
    if (booking.status === STATUS.ONGOING && status === STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel an ongoing booking"
      });
    }

    // Validate status existence
    if (!Object.values(STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
    }

    if (actorRole === "CUSTOMER") {
      return res.status(403).json({
        success: false,
        message: "Customers cannot change booking status directly"
      });
    }

    if (actorRole === "STAFF") {
      if (String(booking.assignedStaffId || "") !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "You can only update bookings assigned to you"
        });
      }

      const allowedStaffTransitions = {
        [STATUS.SCHEDULED]: [STATUS.ONGOING],
        [STATUS.ONGOING]: [STATUS.COMPLETED]
      };

      if (!allowedStaffTransitions[booking.status]?.includes(status)) {
        return res.status(403).json({
          success: false,
          message: "Staff can only start or complete their assigned bookings"
        });
      }
    }

    if (isPrivilegedRole(actorRole)) {
      const allowedAdminTransitions = {
        [STATUS.PENDING]: [STATUS.SCHEDULED, STATUS.CANCELLED],
        [STATUS.SCHEDULED]: [STATUS.CANCELLED]
      };

      if (!allowedAdminTransitions[booking.status]?.includes(status)) {
        return res.status(403).json({
          success: false,
          message: "Admin can only approve, schedule, or cancel active bookings"
        });
      }

      if (status === STATUS.SCHEDULED && !booking.assignedStaffId) {
        return res.status(400).json({
          success: false,
          message: "Assign staff before scheduling a booking"
        });
      }

      if (
        status === STATUS.SCHEDULED &&
        booking.downpaymentRequested &&
        (Number(booking.amountPaid) || 0) < (Number(booking.downpaymentAmount) || 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "Downpayment must be verified before scheduling this booking"
        });
      }
    }

    // Payment check for completion
    if (status === STATUS.COMPLETED) {
      const currentPaid = Number(booking.amountPaid) || 0;
      const total = Number(booking.totalAmount);
      
      if (currentPaid < total) {
        return res.status(400).json({
          success: false,
          message: "Cannot complete booking until the balance is fully paid."
        });
      }
    }

    // Enforce transition logic
    if (!isValidTransition(booking.status, status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition from ${booking.status} to ${status}`
      });
    }

// Define the lock state
    const isNowLocked = status === STATUS.COMPLETED || status === STATUS.CANCELLED;

    // Determine notification content based on status
    const getNotificationContent = (newStatus) => {
      switch (newStatus) {
        case STATUS.SCHEDULED:
          return {
            title: "Booking Confirmed",
            message: `Your appointment on ${new Date(booking.appointmentStart).toLocaleDateString()} at ${new Date(booking.appointmentStart).toLocaleTimeString()} has been confirmed.`
          };
        case STATUS.ONGOING:
          return {
            title: "Service Started",
            message: `Your vehicle service has started. We will notify you when it's complete.`
          };
        case STATUS.COMPLETED:
          return {
            title: "Service Completed",
            message: `Your vehicle service has been marked as completed. Thank you for choosing RENEW!`
          };
        case STATUS.CANCELLED:
          return {
            title: "Booking Cancelled",
            message: `Your booking on ${new Date(booking.appointmentStart).toLocaleDateString()} has been cancelled.`
          };
        default:
          return {
            title: "Booking Updated",
            message: `Your booking status has been updated to ${newStatus}.`
          };
      }
    };

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { 
          status,
          isLocked: isNowLocked ? true : (booking.isLocked || false),
          ...(status === STATUS.SCHEDULED ? { downpaymentRequested: false } : {})
        }
      });

      const notificationContent = getNotificationContent(status);
      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: notificationContent.title,
          message: notificationContent.message,
          type: "BOOKING",
          actionType: status,
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "System",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });

      if (booking.assignedStaffId) {
        await tx.notification.create({
          data: {
            userId: booking.assignedStaffId,
            title: notificationContent.title,
            message: `Booking #${id}: ${notificationContent.message}`,
            type: "BOOKING",
            actionType: status,
            actorId: req.user?.id || null,
            actorName: actor?.fullName || "System",
            targetId: String(id),
            targetName: `Booking #${id}`
          }
        });
      }

      const admins = await tx.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
      });
      
      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            title: `Booking ${status}`,
            message: `Booking #${id} status changed from ${booking.status} to ${status} by ${actor?.fullName || "System"}.`,
            type: "BOOKING",
            actionType: status,
            actorId: req.user?.id || null,
            actorName: actor?.fullName || "System",
            targetId: String(id),
            targetName: `Booking #${id}`
          }
        });
      }

      return updatedBooking;
    });

    res.json({
      success: true,
      booking: result
    });

  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update status"
    });
  }
};

/* RECORD PAYMENT */
const recordPayment = async (req, res) => {
  try {
    const id = parseBookingId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking id"
      });
    }

    const { amount, method } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (!isPrivilegedRole(req.user.role) && req.user.role !== "STAFF") {
      return res.status(403).json({
        success: false,
        message: "Only admins and staff can record payments"
      });
    }

    // Staff can only record CASH payments
    if (req.user.role === "STAFF" && method && method !== "CASH") {
      return res.status(403).json({
        success: false,
        message: "Staff can only record cash payments"
      });
    }

    // 1. Safety Check: Don't accept money for cancelled bookings
    if (booking.status === STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Cannot record payment for a cancelled booking."
      });
    }

    // 2. Calculate the new totals
    const paymentAmount = Number(amount) || 0;
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount"
      });
    }

    const remainingBalance = (Number(booking.totalAmount) || 0) - (Number(booking.amountPaid) || 0);
    if (paymentAmount > remainingBalance) {
      return res.status(400).json({
        success: false,
        message: "Payment exceeds the remaining balance"
      });
    }

    const { newAmountPaid, paymentStatus, nextStatus, downpaymentSatisfied } =
      getUpdatedPaymentState(booking, paymentAmount);

    // 3. Atomic Update (All or Nothing)
    const updated = await prisma.$transaction(async (tx) => {
      // Create the payment history record
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: paymentAmount,
          method: method || "CASH"
        }
      });

      // Update the main booking record
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus,
          status: nextStatus,
          downpaymentRequested: booking.downpaymentRequested ? !downpaymentSatisfied : booking.downpaymentRequested
        }
      });

      const actor = await tx.user.findUnique({ where: { id: req.user?.id } });
      const remaining = (Number(booking.totalAmount) || 0) - newAmountPaid;
      let paymentMessage = `Payment of ₱${paymentAmount.toLocaleString()} received. `;
      
      if (paymentStatus === "PAID") {
        paymentMessage += `Your booking is now fully paid.`;
      } else if (remaining > 0) {
        paymentMessage += `Remaining balance: ₱${remaining.toLocaleString()}.`;
      }

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Payment Received",
          message: paymentMessage,
          type: "PAYMENT",
          actionType: "PAYMENT_RECEIVED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });

      if (nextStatus === STATUS.SCHEDULED && booking.status === STATUS.PENDING) {
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            title: "Booking Confirmed",
            message: `Your booking on ${new Date(booking.appointmentStart).toLocaleDateString()} has been confirmed after downpayment.`,
            type: "BOOKING",
            actionType: "CONFIRMED",
            actorId: req.user?.id || null,
            actorName: actor?.fullName || "Admin",
            targetId: String(id),
            targetName: `Booking #${id}`
          }
        });
      }

      return updatedBooking;
    });

    res.json({
      success: true,
      message: "Payment recorded successfully",
      booking: updated
    });

  } catch (error) {
    console.error("PAYMENT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record payment"
    });
  }
};
/* ADD SERVICE TO BOOKING (WITH VALIDATION) */
const addServiceToBooking = async (req, res) => {
  try {
    const id = parseBookingId(req);
    const { serviceId } = req.body;

    if (!id || !serviceId) {
      return res.status(400).json({ success: false, message: "Booking ID and Service ID required" });
    }

    const booking = await prisma.booking.findUnique({ 
      where: { id },
      include: { items: true } 
    });
    
    const service = await prisma.service.findUnique({ 
      where: { id: Number(serviceId) } 
    });

    if (!booking || !service) {
      return res.status(404).json({ success: false, message: "Booking or Service not found" });
    }

    // 1. Lock Check
    if (booking.status === STATUS.COMPLETED || booking.status === STATUS.CANCELLED) {
      return res.status(400).json({ success: false, message: "Cannot modify a locked booking" });
    }

    // 2. Duplicate Check
    const isDuplicate = booking.items.some(item => item.serviceId === service.id);
    if (isDuplicate) {
      return res.status(400).json({ success: false, message: "Service already exists in this booking" });
    }

    // 3. Calculation & Validation Logic
    const currentDuration = booking.items.reduce((sum, item) => sum + (item.durationAtBooking || 0), 0);
    const totalDuration = currentDuration + (service.durationMin || 0);
    
    const newEnd = new Date(new Date(booking.appointmentStart).getTime() + totalDuration * 60000);

    const settings = await prisma.businessSettings.findFirst();
    const closingHour = settings?.closingHour ?? 18;
    const closingTime = new Date(booking.appointmentStart);
    closingTime.setHours(closingHour, 0, 0, 0);

    if (newEnd > closingTime) {
      return res.status(400).json({ success: false, message: "This service would extend past closing hours" });
    }

    // 4. Update Database (Transaction)
    const result = await prisma.$transaction(async (tx) => {
      await tx.bookingItem.create({
        data: {
          bookingId: id,
          serviceId: service.id,
          serviceNameAtBooking: service.name,
          priceAtBooking: Number(service.price),
          durationAtBooking: service.durationMin,
          quantity: 1
        }
      });

      const allItems = await tx.bookingItem.findMany({ where: { bookingId: id } });
      const newTotal = allItems.reduce((sum, item) => sum + Number(item.priceAtBooking), 0);

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          totalAmount: newTotal,
          appointmentEnd: newEnd
        },
        include: { items: { include: { service: true } } }
      });

      const actor = await tx.user.findUnique({ where: { id: req.user?.id } });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Service Added",
          message: `${service.name} has been added to your booking. New total: ₱${newTotal.toLocaleString()}.`,
          type: "BOOKING",
          actionType: "SERVICE_ADDED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });

      if (booking.assignedStaffId) {
        await tx.notification.create({
          data: {
            userId: booking.assignedStaffId,
            title: "Booking Updated",
            message: `Service "${service.name}" was added to Booking #${id}. New total: ₱${newTotal.toLocaleString()}.`,
            type: "BOOKING",
            actionType: "SERVICE_ADDED",
            actorId: req.user?.id || null,
            actorName: actor?.fullName || "Admin",
            targetId: String(id),
            targetName: `Booking #${id}`
          }
        });
      }

      return updatedBooking;
    });

    return res.json({
      success: true,
      message: "Service added successfully",
      booking: result
    });

  } catch (error) {
    console.error("ADD SERVICE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to add service" });
  }
};/* ADD PAYMENT (SIMPLIFIED) */
const addPayment = async (req, res) => {
  try {
    const id = parseBookingId(req);
    const { amount, method = "CASH" } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (!isPrivilegedRole(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only admins can add payments" });
    }

    // Safety Lock
    if (booking.status === STATUS.COMPLETED || booking.status === STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Cannot add payment to a locked booking"
      });
    }

    const paymentAmount = Number(amount) || 0;
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid payment amount" });
    }

    const remainingBalance = (Number(booking.totalAmount) || 0) - (Number(booking.amountPaid) || 0);
    if (paymentAmount > remainingBalance) {
      return res.status(400).json({ success: false, message: "Payment exceeds the remaining balance" });
    }

    const { newAmountPaid, paymentStatus, nextStatus, downpaymentSatisfied } =
      getUpdatedPaymentState(booking, paymentAmount);

    // Use transaction to ensure both records update together
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: paymentAmount,
          method: method
        }
      });

      await tx.booking.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus,
          status: nextStatus,
          downpaymentRequested: booking.downpaymentRequested ? !downpaymentSatisfied : booking.downpaymentRequested
        }
      });

      const actor = await tx.user.findUnique({ where: { id: req.user?.id } });
      const remaining = (Number(booking.totalAmount) || 0) - newAmountPaid;
      let paymentMessage = `Payment of ₱${paymentAmount.toLocaleString()} received. `;
      
      if (paymentStatus === "PAID") {
        paymentMessage += `Your booking is now fully paid.`;
      } else if (remaining > 0) {
        paymentMessage += `Remaining balance: ₱${remaining.toLocaleString()}.`;
      }

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Payment Received",
          message: paymentMessage,
          type: "PAYMENT",
          actionType: "PAYMENT_RECEIVED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });

      if (nextStatus === STATUS.SCHEDULED && booking.status === STATUS.PENDING) {
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            title: "Booking Confirmed",
            message: `Your booking on ${new Date(booking.appointmentStart).toLocaleDateString()} has been confirmed after downpayment.`,
            type: "BOOKING",
            actionType: "CONFIRMED",
            actorId: req.user?.id || null,
            actorName: actor?.fullName || "Admin",
            targetId: String(id),
            targetName: `Booking #${id}`
          }
        });
      }
    });

    return res.json({ 
      success: true, 
      message: "Payment added successfully",
      newTotalPaid: newAmountPaid 
    });

  } catch (err) {
    console.error("ADD PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* GET AVAILABILITY */
const getAvailability = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date query required (YYYY-MM-DD)"
      });
    }

    const settings = await prisma.businessSettings.findFirst();
    
    const opening = settings?.openingHour ?? 9;
    const closing = settings?.closingHour ?? 18;
    const maxBookings = settings?.maxBookingsPerSlot ?? 3;
    const slotDuration = settings?.slotDurationMinutes ?? 60;

    const availableSlots = [];
    const now = new Date();

    // Parse the requested date
    const [year, month, day] = date.split('-').map(Number);
    const requestedDate = new Date(year, month - 1, day, 0, 0, 0);

    // Get all bookings for this date to check availability
    let existingBookings = [];
    try {
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59);
      
      existingBookings = await prisma.booking.findMany({
        where: {
          OR: [
            { appointmentStart: { gte: startOfDay, lte: endOfDay } },
            { appointmentDate: { gte: startOfDay, lte: endOfDay } }
          ],
          status: {
            notIn: [STATUS.CANCELLED, STATUS.COMPLETED]
          }
        }
      });
    } catch (err) {
      console.error("Error checking existing bookings:", err);
      // Continue with empty bookings - show all slots
    }

    // Build slots based on business hours
    for (let time = opening * 60; time < closing * 60; time += slotDuration) {
      const hour = Math.floor(time / 60);
      const minute = time % 60;

      // Construct slot times for this specific date
      const slotStart = new Date(year, month - 1, day, hour, minute, 0);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

      // For same-day bookings, only skip slots that have completely passed
      // Allow minimum 15 minutes from now for booking
      const minSlotTime = new Date(Date.now() + 15 * 60000);
      if (requestedDate.toDateString() === now.toDateString() && slotStart < minSlotTime) continue;

      // Check if this slot is available
      const isAvailable = !existingBookings.some(booking => {
        const bStart = booking.appointmentStart || booking.appointmentDate;
        const bEnd = booking.appointmentEnd;
        if (!bStart || !bEnd) return false;
        
        // Check overlap
        return bStart < slotEnd && bEnd > slotStart;
      });

      if (isAvailable) {
        // Convert to 12-hour format with AM/PM
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        availableSlots.push(
          `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
        );
      }
    }

    return res.json({
      success: true,
      date,
      slots: availableSlots,
      availableCount: availableSlots.length
    });

  } catch (error) {
    console.error("AVAILABILITY ERROR:", error);
    
    // Return default slots on error (show all possible times)
    const defaultSlots = [];
    for (let hour = 9; hour < 18; hour++) {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      defaultSlots.push(`${displayHour}:00 ${period}`);
      defaultSlots.push(`${displayHour}:30 ${period}`);
    }
    
    return res.json({
      success: true,
      date: req.query.date,
      slots: defaultSlots,
      availableCount: defaultSlots.length,
      fallback: true
    });
  }
};
/* ADMIN ANALYTICS */
const getAdminAnalytics = async (req, res) => {
  try {
    // 1. Booking Counts - count ALL statuses including the legacy ones
    const [total, draft, pendingPayment, partiallyPaid, confirmed, pending, scheduled, ongoing, completed, cancelled] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "draft" } }),
      prisma.booking.count({ where: { status: "pending" } }),
      prisma.booking.count({ where: { status: "pending_payment" } }),
      prisma.booking.count({ where: { status: "partially_paid" } }),
      prisma.booking.count({ where: { status: "confirmed" } }),
      prisma.booking.count({ where: { status: "scheduled" } }),
      prisma.booking.count({ where: { status: "ongoing" } }),
      prisma.booking.count({ where: { status: "completed" } }),
      prisma.booking.count({ where: { status: "cancelled" } })
    ]);

    // 2. Revenue (Total money actually received across ALL bookings)
    const allPayments = await prisma.payment.findMany({
      select: { amount: true }
    });
    
    const totalRevenue = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // 3. Pending Receivables (Money still owed to the shop)
    const bookingsWithBalance = await prisma.booking.findMany({
      where: { 
        status: { notIn: [STATUS.CANCELLED, STATUS.COMPLETED] }
      },
      select: { totalAmount: true, amountPaid: true }
    });

    const pendingRevenue = bookingsWithBalance.reduce((sum, b) => {
      const balance = Number(b.totalAmount) - (Number(b.amountPaid) || 0);
      return sum + (balance > 0 ? balance : 0);
    }, 0);

    return res.json({
      success: true,
      analytics: {
        counts: {
          total,
          draft,
          pendingPayment,
          partiallyPaid,
          confirmed,
          pending,
          scheduled,
          ongoing,
          completed,
          cancelled
        },
        finances: {
          totalRevenue,
          pendingRevenue,
          averageBookingValue: total > 0 ? (totalRevenue / total).toFixed(2) : 0
        }
      }
    });

  } catch (err) {
    console.error("Admin analytics error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load analytics"
    });
  }
};

/* REQUEST DOWNPAYMENT */
const requestDownpayment = async (req, res) => {
  try {
    const id = parseBookingId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking id"
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (booking.status !== STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: "Downpayment can only be requested for pending bookings"
      });
    }

    // Prevent duplicate request
    if (booking.downpaymentRequested) {
      return res.status(400).json({
        success: false,
        message: "Downpayment already requested"
      });
    }

    const amount = calculateDownpayment(Number(booking.totalAmount));

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "This booking does not require a downpayment"
      });
    }

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: {
          downpaymentRequested: true,
          downpaymentAmount: amount
        }
      });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Downpayment Required",
          message: `Downpayment of ₱${amount.toLocaleString()} required. Please settle to secure your slot.`,
          type: "PAYMENT",
          actionType: "DOWNPAYMENT_REQUESTED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });
    });

    return res.json({
      success: true,
      message: "Downpayment request sent successfully"
    });

  } catch (error) {
    console.error("REQUEST DOWNPAYMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request downpayment"
    });
  }
};
/* ADMIN SCHEDULE VIEW */
const getDailySchedule = async (req, res) => {
  try {
    const { date } = req.query; // Expecting YYYY-MM-DD

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date query required"
      });
    }

    // Surgical Date Range: Start of the day to the very start of the next day
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        appointmentStart: {
          gte: start,
          lt: end 
        },
        status: {
          not: STATUS.CANCELLED
        }
      },
      include: {
        customer: {
          select: {
            fullName: true,
            email: true,
          }
        },
        assignedStaff: {
          select: {
            fullName: true
          }
        },
        items: {
          include: {
            service: true
          }
        }
      },
      orderBy: {
        appointmentStart: "asc"
      }
    });

    return res.json({
      success: true,
      count: bookings.length,
      bookings
    });

  } catch (error) {
    console.error("SCHEDULE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load schedule"
    });
  }
};

// ================= ADDON REQUEST =================

// CREATE
const createAddonRequest = async (req, res) => {
  try {
    const id = parseBookingId(req);
    const { services } = req.body; // Expecting array of service IDs

    if (!id || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Booking ID and services array required" 
      });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if ([STATUS.COMPLETED, STATUS.CANCELLED].includes(booking.status)) {
      return res.status(400).json({ success: false, message: "Cannot modify a locked booking" });
    }

    const request = await prisma.addonRequest.create({
      data: {
        bookingId: id,
        services: services, // JSON field
        status: "PENDING"
      }
    });

    // Notify admins about the addon request
    await notifyAdminsBookingUpdated(id, "Addon Request", `Customer requested add-on services.`);

    return res.json({ success: true, request });
  } catch (err) {
    console.error("ADDON CREATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to create addon request" });
  }
};
// APPROVE (REFACTORED FOR SAFETY)
const approveAddonRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.addonRequest.findUnique({
      where: { id: Number(id) },
      include: { booking: true }
    });

    if (!request || request.status !== "PENDING") {
      return res.status(400).json({ success: false, message: "Invalid or already processed request" });
    }

    // 1. Get all service details at once
    const serviceIds = Array.isArray(request.services) ? request.services.map(Number) : [];
    const serviceDetails = await prisma.service.findMany({
      where: { id: { in: serviceIds } }
    });

    if (serviceDetails.length === 0) {
      return res.status(400).json({ success: false, message: "No valid services found in request" });
    }

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    const updatedBooking = await prisma.$transaction(async (tx) => {
      let totalAdd = 0;
      let totalDurationAdd = 0;
      const serviceNames = [];

      for (const service of serviceDetails) {
        await tx.bookingItem.create({
          data: {
            bookingId: request.bookingId,
            serviceId: service.id,
            serviceNameAtBooking: service.name,
            priceAtBooking: Number(service.price),
            durationAtBooking: service.durationMin,
            quantity: 1
          }
        });
        totalAdd += Number(service.price);
        totalDurationAdd += (service.durationMin || 0);
        serviceNames.push(service.name);
      }

      await tx.addonRequest.update({
        where: { id: Number(id) },
        data: { status: "APPROVED" }
      });

      const newEnd = new Date(new Date(request.booking.appointmentEnd).getTime() + totalDurationAdd * 60000);

      const updated = await tx.booking.update({
        where: { id: request.bookingId },
        data: {
          totalAmount: { increment: totalAdd },
          appointmentEnd: newEnd
        },
        include: { items: true }
      });

      await tx.notification.create({
        data: {
          userId: request.booking.customerId,
          title: "Add-on Approved",
          message: `Your add-on request (${serviceNames.join(", ")}) has been approved. New total: ₱${updated.totalAmount.toLocaleString()}.`,
          type: "BOOKING",
          actionType: "ADDON_APPROVED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(request.bookingId),
          targetName: `Booking #${request.bookingId}`
        }
      });

      return updated;
    });

    return res.json({ success: true, message: "Add-on approved", booking: updatedBooking });
  } catch (err) {
    console.error("APPROVE ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to approve add-on request" });
  }
};

// REJECT
const rejectAddonRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await prisma.addonRequest.findUnique({
      where: { id: Number(id) },
      include: { booking: true }
    });

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    await prisma.$transaction(async (tx) => {
      await tx.addonRequest.update({
        where: { id: Number(id) },
        data: { status: "REJECTED" }
      });

      await tx.notification.create({
        data: {
          userId: request.booking.customerId,
          title: "Add-on Rejected",
          message: `Your add-on request has been rejected. Please contact us for more information.`,
          type: "BOOKING",
          actionType: "ADDON_REJECTED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(request.bookingId),
          targetName: `Booking #${request.bookingId}`
        }
      });
    });

    return res.json({ success: true, message: "Add-on rejected" });
  } catch (err) {
    console.error("REJECT ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to reject add-on request" });
  }
};

/* STAFF REQUEST CANCEL */
const requestCancelBooking = async (req, res) => {
  try {
    const id = parseBookingId(req);
    const { reason } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking id"
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { customer: true, assignedStaff: true }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (req.user.role !== "STAFF" || String(booking.assignedStaffId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Only assigned staff can request cancellation"
      });
    }

    if (![STATUS.PENDING, STATUS.SCHEDULED].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot request cancellation for this booking"
      });
    }

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });

    await prisma.$transaction(async (tx) => {
      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            title: "Cancel Request",
            message: `${booking.assignedStaff.fullName} requested to cancel Booking #${id} (${booking.customer?.fullName || "Customer"}). ${reason ? `Reason: ${reason}` : ""}`,
            type: "BOOKING",
            actionType: "CANCEL_REQUESTED",
            actorId: req.user?.id || null,
            actorName: actor?.fullName || "Staff",
            targetId: String(id),
            targetName: `Booking #${id}`
          }
        });
      }
    });

    return res.json({
      success: true,
      message: "Cancellation request sent to admin"
    });

  } catch (error) {
    console.error("REQUEST CANCEL ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request cancellation"
    });
  }
};
/* UPDATE BOOKING */
const updateBooking = async (req, res) => {
  try {
    const id = parseBookingId(req);
    const {
      services,
      appointmentStart,
      notes,
      vehicleType,
      plateNumber,
      contactNumber,
      email,
      vehicleBrand,
      vehicleModel
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (String(booking.customerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You can only edit your own booking" });
    }

    if (booking.status !== STATUS.SCHEDULED) {
      return res.status(400).json({
        success: false,
        message: "Only scheduled bookings can be edited"
      });
    }

    if (!services || services.length === 0) {
      return res.status(400).json({ success: false, message: "No services selected" });
    }

    if (!appointmentStart) {
      return res.status(400).json({ success: false, message: "Appointment date and time are required" });
    }

    const start = new Date(appointmentStart);
    start.setSeconds(0, 0);

    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid appointment date" });
    }

    const now = new Date();
    const minimumNoticeMinutes = 30;
    const minStart = new Date(Date.now() + minimumNoticeMinutes * 60000);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);

    if (start < now) {
      return res.status(400).json({ success: false, message: "Cannot move a booking to the past" });
    }

    if (start < minStart) {
      return res.status(400).json({
        success: false,
        message: "Bookings must be made at least 30 minutes in advance"
      });
    }

    if (start > maxDate) {
      return res.status(400).json({
        success: false,
        message: "Bookings cannot be made more than 60 days in advance"
      });
    }

    const settings = await prisma.businessSettings.findFirst();
    const defaults = { openingHour: 9, closingHour: 18, maxBookingsPerSlot: 3 };
    const openingHour = settings?.openingHour ?? defaults.openingHour;
    const closingHour = settings?.closingHour ?? defaults.closingHour;
    const maxBookingsPerSlot = settings?.maxBookingsPerSlot ?? defaults.maxBookingsPerSlot;

    const startHour = start.getHours();
    // Allow exactly at closing hour (e.g., 6 PM booking is OK)
    if (startHour < openingHour || startHour > closingHour) {
      return res.status(400).json({ success: false, message: `Booking must be between ${openingHour}:00 and ${closingHour}:00` });
    }

    const serviceIds = services.map(Number).filter((value) => !isNaN(value));
    if (serviceIds.length !== services.length) {
      return res.status(400).json({ success: false, message: "One or more services are invalid" });
    }

    const dbServices = await prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true }
    });

    if (dbServices.length !== serviceIds.length) {
      return res.status(400).json({ success: false, message: "One or more services are invalid" });
    }

    const totalDuration = calculateTotalDuration(dbServices);
    if (totalDuration <= 0) {
      return res.status(400).json({ success: false, message: "Invalid service duration" });
    }

    const end = new Date(start.getTime() + totalDuration * 60000);
    const closingTime = new Date(start);
    closingTime.setHours(closingHour + 1, 0, 0, 0);

    if (end > closingTime) {
      return res.status(400).json({ success: false, message: "Service would extend past closing time" });
    }

    const customerConflict = await prisma.booking.findFirst({
      where: {
        customerId: String(req.user.id),
        id: { not: id },
        status: { in: [STATUS.PENDING, STATUS.SCHEDULED, STATUS.ONGOING] },
        appointmentStart: { lt: end },
        appointmentEnd: { gt: start }
      }
    });

    if (customerConflict) {
      return res.status(400).json({
        success: false,
        message: "You already have another booking during this time"
      });
    }

    const overlappingBookings = await prisma.booking.count({
      where: {
        id: { not: id },
        appointmentStart: { lt: end },
        appointmentEnd: { gt: start },
        status: { notIn: [STATUS.CANCELLED, STATUS.COMPLETED] }
      }
    });

    if (overlappingBookings + 1 > maxBookingsPerSlot) {
      return res.status(400).json({
        success: false,
        message: "Selected time slot is fully booked"
      });
    }

    let totalAmount = 0;
    const newItemsData = dbServices.map(service => {
      const price = Number(service.price);
      totalAmount += price;
      return {
        bookingId: id,
        serviceId: service.id,
        serviceNameAtBooking: service.name,
        priceAtBooking: price,
        durationAtBooking: service.durationMin,
        quantity: 1
      };
    });

    let downpaymentRequired = 0;
    if (totalAmount > 5000 && totalAmount <= 6000) {
      downpaymentRequired = 3500;
    } else if (totalAmount > 6000) {
      downpaymentRequired = 5000;
    }

    const nextStatus = downpaymentRequired > 0 ? STATUS.PENDING : STATUS.SCHEDULED;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.bookingItem.deleteMany({ where: { bookingId: id } });
      await tx.bookingItem.createMany({ data: newItemsData });

      return await tx.booking.update({
        where: { id },
        data: {
          appointmentStart: start,
          appointmentEnd: end,
          notes,
          vehicleType,
          plateNumber,
          contactNumber,
          email,
          vehicleBrand,
          vehicleModel,
          totalAmount,
          status: nextStatus,
          downpaymentRequested: downpaymentRequired > 0,
          downpaymentAmount: downpaymentRequired > 0 ? downpaymentRequired : null
        }
      });
    });

    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: nextStatus === STATUS.SCHEDULED ? "Booking Updated" : "Booking Updated - Downpayment Required",
        message:
          nextStatus === STATUS.SCHEDULED
            ? "Your booking changes were saved successfully."
            : `Your booking changes were saved. A downpayment of ₱${downpaymentRequired.toLocaleString()} is now required.`,
        type: "BOOKING",
        actionType: "UPDATED",
        actorId: req.user?.id || null,
        actorName: booking.customer?.fullName || "Customer",
        targetId: String(id),
        targetName: `Booking #${id}`
      }
    });

    await notifyAdminsBookingUpdated(id, "Updated", `Customer ${booking.customer?.fullName || "Unknown"} updated their booking.`, req.user?.id, booking.customer?.fullName);

    if (booking.assignedStaffId) {
      await prisma.notification.create({
        data: {
          userId: booking.assignedStaffId,
          title: "Booking Updated",
          message: `Booking #${id} was modified by the customer.`,
          type: "BOOKING",
          actionType: "UPDATED",
          actorId: req.user?.id || null,
          actorName: booking.customer?.fullName || "Customer",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });
    }

    return res.json({
      success: true,
      message: "Booking updated successfully",
      booking: updated,
      downpaymentRequired
    });
  } catch (err) {
    console.error("UPDATE BOOKING ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to update booking" });
  }
};

const confirmDownpayment = async (req, res) => {
  try {
    const id = parseBookingId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking id"
      });
    }

    if (!isPrivilegedRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can verify downpayments"
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    if (!booking.downpaymentRequested || !booking.downpaymentAmount) {
      return res.status(400).json({
        success: false,
        message: "This booking does not have a pending downpayment to verify"
      });
    }

    const currentPaid = Number(booking.amountPaid) || 0;
    const downpaymentAmount = Number(booking.downpaymentAmount) || 0;
    const remainingDownpayment = downpaymentAmount - currentPaid;

    if (remainingDownpayment <= 0) {
      return res.status(400).json({
        success: false,
        message: "Downpayment has already been verified"
      });
    }

    const { newAmountPaid, paymentStatus, nextStatus } =
      getUpdatedPaymentState(booking, remainingDownpayment);

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: remainingDownpayment,
          method: "CASH"
        }
      });

      const result = await tx.booking.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus,
          status: nextStatus,
          downpaymentRequested: false
        }
      });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Downpayment Verified",
          message: "Your downpayment has been verified and your booking is now scheduled.",
          type: "PAYMENT",
          actionType: "DOWNPAYMENT_VERIFIED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });

      return result;
    });

    return res.json({
      success: true,
      message: "Downpayment verified successfully",
      booking: updated
    });
  } catch (error) {
    console.error("CONFIRM DOWNPAYMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify downpayment"
    });
  }
};

const getBookings = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = String(req.user.id);
    let where = {};

    if (role === "CUSTOMER") {
      where.customerId = userId;
    } else if (role === "STAFF") {
      where.assignedStaffId = userId;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        customer: {
          select: { id: true, fullName: true, email: true, phone: true }
        },
        assignedStaff: {
          select: { id: true, fullName: true }
        },
        items: {
          include: { service: true }
        },
        payments: true
      },
      orderBy: { appointmentStart: "desc" }
    });

    res.json({ bookings, success: true });
  } catch (error) {
    console.error("GET BOOKINGS ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
};

const getBookingById = async (req, res) => {
  try {
    const id = parseBookingId(req);
    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedStaff: { select: { id: true, fullName: true } },
        items: { include: { service: true } },
        payments: true,
        addonRequests: true
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Security check: Match string IDs
    if (req.user.role === "CUSTOMER" && String(booking.customerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Unauthorized access" });
    }

    res.json(booking);
  } catch (error) {
    console.error("GET BOOKING BY ID ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch booking details" });
  }
};
const getAddonRequests = async (req, res) => {
  try {
    const bookingId = parseBookingId(req);
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const addons = await prisma.addonRequest.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" }
    });

    // Since 'services' is a JSON array of IDs, we fetch the service details manually
    const addonsWithDetails = await Promise.all(
      addons.map(async (addon) => {
        const serviceIds = Array.isArray(addon.services) ? addon.services.map(Number) : [];
        const details = await prisma.service.findMany({
          where: { id: { in: serviceIds } }
        });
        return { ...addon, serviceDetails: details };
      })
    );

    res.json({
      success: true,
      addons: addonsWithDetails
    });
  } catch (error) {
    console.error("GET ADDON REQUESTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch addon requests" });
  }
};

/* CUSTOMER REQUEST CANCEL */
const requestCustomerCancel = async (req, res) => {
  try {
    const id = parseBookingId(req);
    const { reason } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Only customer can request cancel their own booking
    if (req.user.role === "CUSTOMER" && String(booking.customerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You can only request cancellation for your own bookings" });
    }

    // Check valid status
    if (booking.status !== STATUS.PENDING && booking.status !== STATUS.SCHEDULED) {
      return res.status(400).json({ success: false, message: "Cannot request cancellation for this booking" });
    }

    // Update booking status to CANCEL_REQUESTED
    await prisma.booking.update({
      where: { id },
      data: {
        status: STATUS.CANCEL_REQUESTED,
        cancellationReason: reason || "Customer requested cancellation"
      }
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: "Cancel Request",
          message: `Customer ${booking.customer?.fullName || "Unknown"} requested cancellation for Booking #${id}. Reason: ${reason || "Not provided"}`,
          type: "BOOKING",
          actionType: "CANCEL_REQUESTED",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });
    }

    return res.json({ success: true, message: "Cancellation request submitted. An admin will review your request." });

  } catch (error) {
    console.error("REQUEST CUSTOMER CANCEL ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
  requestCustomerCancel,
  assignStaff,
  updateBookingStatus,
  recordPayment,
  confirmDownpayment,
  addPayment,
  requestDownpayment,
  addServiceToBooking,
  getAvailability,
  getAdminAnalytics,
  getDailySchedule,
  createAddonRequest,
  getAddonRequests,
  updateBooking,
  approveAddonRequest,
  rejectAddonRequest,
  requestCancelBooking,
};

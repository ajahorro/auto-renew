const prisma = require("../config/prisma");
const LOG_REQUEST = require("../utils/logRequest");
const { createNotification } = require("../services/notification.service");

const STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  SCHEDULED: "SCHEDULED",
  ONGOING: "ONGOING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  PENDING_PAYMENT: "PENDING_PAYMENT"
};

const parseBookingId = (req) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return null;
  return id;
};

const isPrivilegedRole = (role) => {
  const r = String(role || "").toUpperCase();
  return r === "ADMIN" || r === "SUPER_ADMIN";
};

const VALID_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED", "ONGOING"],
  CONFIRMED: ["ONGOING", "CANCELLED", "COMPLETED"],
  SCHEDULED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  PENDING_PAYMENT: ["PENDING", "CONFIRMED", "CANCELLED"]
};

const isValidTransition = (current, next) => {
  if (current === next) return true;
  return VALID_TRANSITIONS[current]?.includes(next) || false;
};

const notifyAdminsBookingUpdated = async (bookingId, title, message) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    for (const admin of admins) {
      await createNotification(admin.id, {
        title,
        message,
        type: "BOOKING",
        actionType: "BOOKING_UPDATED",
        targetId: String(bookingId),
        targetName: `Booking #${bookingId}`
      });
    }
  } catch (error) {
    console.error("Failed to notify admins:", error);
  }
};

function calculateDownpayment(total) {
  if (total >= 5000) {
    return total * 0.5;
  }
  return 0;
}

function calculateTotalDuration(services) {
  if (!Array.isArray(services)) return 0;
  let total = 0;
  services.forEach(service => {
    total += service.durationMin || 0;
  });
  return total;
}

function getUpdatedPaymentState(booking, paymentAmount) {
  const currentPaid = Number(booking.amountPaid) || 0;
  const totalAmount = Number(booking.totalAmount) || 0;
  const newAmountPaid = currentPaid + paymentAmount;

  let nextStatus = booking.status;
  if (newAmountPaid >= totalAmount && totalAmount > 0) {
    if (booking.status === STATUS.PENDING || booking.status === STATUS.PENDING_PAYMENT) {
      nextStatus = STATUS.CONFIRMED;
    }
  }

  return {
    newAmountPaid,
    nextStatus,
    downpaymentSatisfied: true
  };
}

function isMissingTableError(error, tableName) {
  return error?.code === "P2021" && String(error?.meta?.table || "").includes(tableName);
}




function isAddonRequestUnavailable(error) {
  return isMissingTableError(error, "AddonRequest");
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
const createBooking = async (req, res) => {
  try {
    LOG_REQUEST(req, "CREATE_BOOKING");
    
    const userId = req.user?.id ? String(req.user.id) : null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user token"
      });
    }

    const {
      customerId,
      services,
      paymentMethod,
      scheduledDate,
      scheduledTime,
      appointmentStart: bodyAppointmentStart,
      totalAmount,
      notes,
      vehicleType,
      plateNumber,
      contactNumber,

      vehicleBrand,
      vehicleModel
    } = req.body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: "services array is required and must not be empty"
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "paymentMethod is required"
      });
    }

    const validPaymentMethods = ["GCASH", "CASH", "GCASH_POST_SERVICE"];
    const normalizedPaymentMethod = String(paymentMethod).toUpperCase();
    if (!validPaymentMethods.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "paymentMethod must be 'GCASH', 'CASH', or 'GCASH_POST_SERVICE'"
      });
    }

    const parsedTotalAmount = Number(totalAmount);
    if (!Number.isFinite(parsedTotalAmount) || parsedTotalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "totalAmount must be a positive number"
      });
    }

    let appointmentStart;
    if (bodyAppointmentStart) {
      appointmentStart = new Date(bodyAppointmentStart);
    } else if (scheduledDate && scheduledTime) {
      appointmentStart = new Date(`${scheduledDate}T${scheduledTime}:00`);
    } else {
      return res.status(400).json({
        success: false,
        message: "Either appointmentStart or scheduledDate/scheduledTime is required"
      });
    }
    
    if (Number.isNaN(appointmentStart.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date/time format"
      });
    }
    
    const now = new Date();
    if (appointmentStart < now) {
      return res.status(400).json({
        success: false,
        message: "Cannot create booking in the past"
      });
    }

    const serviceIds = services.map(Number).filter(n => !isNaN(n));
    if (serviceIds.length !== services.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid service IDs"
      });
    }

    const dbServices = await prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true }
    });

    if (dbServices.length === 0 || dbServices.length !== serviceIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more services are invalid or inactive"
      });
    }

    const totalDuration = calculateTotalDuration(dbServices);
    const appointmentEnd = new Date(appointmentStart.getTime() + totalDuration * 60000);

    const settings = await prisma.businessSettings.findFirst();
    const defaults = { openingHour: 9, closingHour: 18, maxBookingsPerSlot: 3 };
    const maxBookingsPerSlot = settings?.maxBookingsPerSlot ?? defaults.maxBookingsPerSlot;

    const items = dbServices.map(service => ({
      serviceId: service.id,
      serviceNameAtBooking: service.name,
      priceAtBooking: Number(service.price),
      durationAtBooking: service.durationMin,
      quantity: 1
    }));

    const finalCustomerId = customerId ? String(customerId) : userId;

    const booking = await prisma.$transaction(async (tx) => {
      const existingBookingsCount = await tx.booking.count({
        where: {
          appointmentStart: { lt: appointmentEnd },
          appointmentEnd: { gt: appointmentStart },
          status: { notIn: [STATUS.CANCELLED, STATUS.COMPLETED] }
        }
      });

      if (existingBookingsCount >= maxBookingsPerSlot) {
        throw new Error("Selected time slot is fully booked. Please choose another time.");
      }

      const newBooking = await tx.booking.create({
        data: {
          customerId: finalCustomerId,
          status: STATUS.PENDING,
          cancellationStatus: "NONE",
          refundStatus: "NONE",
          paymentStatus: "PENDING",
          appointmentStart,
          appointmentEnd,
          totalAmount: parsedTotalAmount,
          amountPaid: 0,
          paymentMethod: normalizedPaymentMethod,
          vehicleType: vehicleType || null,
          plateNumber: plateNumber || null,
          contactNumber: contactNumber || null,
          vehicleBrand: vehicleBrand || null,
          vehicleModel: vehicleModel || null,
          notes: notes || null,
          items: {
            create: items
          }
        },
        include: { items: true }
      });

      await tx.notification.create({
        data: {
          userId: finalCustomerId,
          title: "Booking Created",
          message: `Your booking for ${appointmentStart.toLocaleDateString()} has been received and is pending confirmation.`,
          type: "BOOKING",
          actionType: "BOOKING_CREATED"
        }
      });

      return newBooking;
    });

    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    for (const admin of admins) {
      await createNotification(admin.id, {
        title: "New Booking Created",
        message: `New booking created. Total: ₱${parsedTotalAmount.toLocaleString()}`,
        type: "BOOKING",
        actionType: "BOOKING_CREATED",
        targetId: String(booking.id),
        targetName: `Booking #${booking.id}`
      });
    }

    res.status(201).json({
      success: true,
      booking
    });

  } catch (error) {
    console.error("ERROR [CREATE_BOOKING]:", error);
    // Check for known business logic errors (e.g., slot fully booked)
    if (error.message && error.message.includes("fully booked")) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};
const cancelBooking = async (req, res) => {
  try {
    LOG_REQUEST(req, "CANCEL_BOOKING");
    
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

    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can cancel bookings"
      });
    }

    if (booking.status !== STATUS.PENDING && booking.status !== STATUS.CONFIRMED) {
      return res.status(400).json({
        success: false,
        message: "Only pending or confirmed bookings can be cancelled"
      });
    }

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { 
          status: STATUS.CANCELLED,
          cancellationStatus: "APPROVED"
        }
      });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Booking Cancelled",
          message: `Your booking has been cancelled.`,
          type: "BOOKING",
          actionType: "CANCELLED",
          actorId: req.user?.id || null,
          actorName: actor?.fullName || "Admin",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });

      return updatedBooking;
    });

    res.json({
      success: true,
      booking: result
    });

  } catch (error) {
    console.error("ERROR [CANCEL_BOOKING]:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};
/* ASSIGN STAFF (SMART ASSIGNMENT) */
const assignStaff = async (req, res) => {
  try {
    LOG_REQUEST(req, "ASSIGN_STAFF");
    
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

    // Allow assignment for bookings that are still actionable before or during service.
    if (![STATUS.PENDING, STATUS.CONFIRMED, STATUS.ONGOING].includes(booking.status)) {
      return res.status(400).json({ success: false, message: "Staff can only be assigned to pending, confirmed, or ongoing bookings" });
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
      if (!staff || staff.role !== "STAFF" || !staff.isActive) {
        return res.status(400).json({ success: false, message: "Invalid or inactive staff" });
      }

      const conflict = await prisma.booking.findFirst({
        where: {
          assignedStaffId: String(assignedStaffId),
          id: { not: id },
          status: { in: [STATUS.PENDING, STATUS.CONFIRMED, STATUS.ONGOING] },
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
        status: { in: [STATUS.PENDING, STATUS.CONFIRMED, STATUS.ONGOING] },
            appointmentStart: { lt: booking.appointmentEnd },
            appointmentEnd: { gt: booking.appointmentStart }
          }
        });

        if (!conflict) {
          const workload = await prisma.booking.count({
            where: {
              assignedStaffId: staff.id,
              status: { in: [STATUS.PENDING, STATUS.CONFIRMED, STATUS.ONGOING] }
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
        data: { 
          assignedStaffId: String(assignedStaffId),
          status: booking.status === STATUS.PENDING ? STATUS.CONFIRMED : booking.status
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
    LOG_REQUEST(req, "UPDATE_BOOKING_STATUS");
    
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
        [STATUS.CONFIRMED]: [STATUS.ONGOING],
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
        [STATUS.PENDING]: [STATUS.CONFIRMED, STATUS.CANCELLED],
        [STATUS.CONFIRMED]: [STATUS.CANCELLED]
      };

      if (!allowedAdminTransitions[booking.status]?.includes(status)) {
        return res.status(403).json({
          success: false,
          message: "Admin can only confirm or cancel active bookings"
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

    const getNotificationContent = (newStatus) => {
      switch (newStatus) {
        case STATUS.CONFIRMED:
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
        data: { status, isLocked: isNowLocked }
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
    LOG_REQUEST(req, "RECORD_PAYMENT");
    
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

    const { newAmountPaid, nextStatus } =
      getUpdatedPaymentState(booking, paymentAmount);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: paymentAmount,
          method: method || "CASH",
          status: "APPROVED"
        }
      });

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          status: nextStatus
        }
      });

      const actor = await tx.user.findUnique({ where: { id: req.user?.id } });
      const remaining = (Number(booking.totalAmount) || 0) - newAmountPaid;
      let paymentMessage = `Payment of ₱${paymentAmount.toLocaleString()} received. `;
      
      if (nextStatus === STATUS.CONFIRMED) {
        paymentMessage += `Your booking is now fully paid and confirmed.`;
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

      if (nextStatus === STATUS.CONFIRMED && booking.status === STATUS.PENDING) {
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            title: "Booking Confirmed",
            message: `Your booking on ${new Date(booking.appointmentStart).toLocaleDateString()} has been confirmed after payment.`,
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
    LOG_REQUEST(req, "ADD_SERVICE_TO_BOOKING");
    
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

    const { newAmountPaid, nextStatus } =
      getUpdatedPaymentState(booking, paymentAmount);

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: paymentAmount,
          method: method,
          status: "APPROVED"
        }
      });

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          status: nextStatus
        }
      });

      const actor = await tx.user.findUnique({ where: { id: req.user?.id } });
      const remaining = (Number(booking.totalAmount) || 0) - newAmountPaid;
      let paymentMessage = `Payment of ₱${paymentAmount.toLocaleString()} received. `;
      
      if (nextStatus === STATUS.CONFIRMED) {
        paymentMessage += `Your booking is now fully paid and confirmed.`;
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

      if (nextStatus === STATUS.CONFIRMED && booking.status === STATUS.PENDING) {
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            title: "Booking Confirmed",
            message: `Your booking on ${new Date(booking.appointmentStart).toLocaleDateString()} has been confirmed after payment.`,
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

    return res.json({ 
      success: true, 
      message: "Payment added successfully",
      newTotalPaid: newAmountPaid,
      booking: result
    });

  } catch (err) {
    console.error("ERROR [ADD_PAYMENT]:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* GET AVAILABILITY */
const getAvailability = async (req, res) => {
  try {
    LOG_REQUEST(req, "GET_AVAILABILITY");
    
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
          appointmentStart: { gte: startOfDay, lte: endOfDay },
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

      // Count bookings that overlap with this slot
      const currentBookingsCount = existingBookings.filter(booking => {
        const bStart = booking.appointmentStart;
        const bEnd = booking.appointmentEnd;
        if (!bStart || !bEnd) return false;
        // Check overlap
        return bStart < slotEnd && bEnd > slotStart;
      }).length;

      // Check if slot is full
      const isFull = currentBookingsCount >= maxBookings;

      // Convert to 12-hour format with AM/PM
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const timeString = `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;

      availableSlots.push({
        time: timeString,
        isFull,
        currentCount: currentBookingsCount,
        maxCount: maxBookings,
        available: !isFull
      });
    }

    return res.json({
      success: true,
      date,
      slots: availableSlots,
      availableCount: availableSlots.filter(s => !s.isFull).length,
      maxBookingsPerSlot: maxBookings
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
      slots: defaultSlots.map(time => ({ time, isFull: false, currentCount: 0, maxCount: 3, available: true })),
      availableCount: defaultSlots.length,
      fallback: true,
      maxBookingsPerSlot: 3
    });
  }
};
const getAdminAnalytics = async (req, res) => {
  try {
    LOG_REQUEST(req, "ADMIN_ANALYTICS");
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total,
      pending,
      scheduled,
      ongoing,
      completed,
      cancelled,
      todayBookings,
      weekBookings,
      monthBookings,
      allBookings
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "PENDING" } }),
      prisma.booking.count({ where: { status: "SCHEDULED" } }),
      prisma.booking.count({ where: { status: "ONGOING" } }),
      prisma.booking.count({ where: { status: "COMPLETED" } }),
      prisma.booking.count({ where: { status: "CANCELLED" } }),
      prisma.booking.count({ where: { appointmentStart: { gte: startOfToday } } }),
      prisma.booking.count({ where: { appointmentStart: { gte: startOfWeek } } }),
      prisma.booking.count({ where: { appointmentStart: { gte: startOfMonth } } }),
      prisma.booking.findMany({
        where: { status: { notIn: ["PENDING"] } },
        include: { 
          items: { include: { service: true } },
          payments: true
        }
      })
    ]);

    const allPayments = await prisma.payment.findMany({
      where: { status: { in: ["APPROVED", "VERIFIED", "COMPLETED"] } },
      select: { amount: true, method: true }
    });
    
    const totalRevenue = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const gcashRevenue = allPayments
      .filter(p => p.method === "GCASH" || p.method === "GCASH_POST_SERVICE")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const cashRevenue = allPayments
      .filter(p => p.method === "CASH")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const bookingsWithBalance = await prisma.booking.findMany({
      where: { 
        status: { notIn: ["CANCELLED", "COMPLETED"] }
      },
      select: { totalAmount: true, amountPaid: true, paymentStatus: true }
    });

    const pendingRevenue = bookingsWithBalance.reduce((sum, b) => {
      const total = Number(b.totalAmount) || 0;
      const paid = Number(b.amountPaid) || 0;
      const balance = total - paid;
      return sum + (balance > 0 ? balance : 0);
    }, 0);

    const paidBookings = allBookings.filter(b => {
      const paid = Number(b.amountPaid) || 0;
      const total = Number(b.totalAmount) || 0;
      return paid >= total;
    }).length;
    const unpaidBookings = total - paidBookings - cancelled;

    const bookingsPerService = {};
    const bookingsPerHour = {};
    allBookings.forEach(booking => {
      booking.items.forEach(item => {
        const serviceName = item.service?.name || "Unknown";
        bookingsPerService[serviceName] = (bookingsPerService[serviceName] || 0) + 1;
      });
      if (booking.appointmentStart) {
        const hour = new Date(booking.appointmentStart).getHours();
        bookingsPerHour[hour] = (bookingsPerHour[hour] || 0) + 1;
      }
    });

    const peakHours = Object.entries(bookingsPerHour)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
        label: `${hour}:00`
      }));

    const bookingsPerDay = {};
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      bookingsPerDay[i] = 0;
    }
    allBookings.forEach(booking => {
      if (booking.appointmentStart) {
        const date = new Date(booking.appointmentStart);
        if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
          const day = date.getDate();
          bookingsPerDay[day] = (bookingsPerDay[day] || 0) + 1;
        }
      }
    });

    const totalDaysWithBookings = Object.values(bookingsPerDay).filter(v => v > 0).length;
    const avgBookingsPerDay = totalDaysWithBookings > 0 
      ? Number((total / totalDaysWithBookings).toFixed(1)) 
      : 0;

    const cancellationRate = total > 0 
      ? Number(((cancelled / total) * 100).toFixed(1)) 
      : 0;

    const staffBookings = await prisma.booking.groupBy({
      by: ["assignedStaffId"],
      where: { assignedStaffId: { not: null } },
      _count: { id: true }
    });

    const staffWithNames = await Promise.all(
      staffBookings.map(async (sb) => {
        const staff = await prisma.user.findUnique({
          where: { id: sb.assignedStaffId },
          select: { fullName: true }
        });
        const completedCount = await prisma.booking.count({
          where: { 
            assignedStaffId: sb.assignedStaffId,
            status: "COMPLETED"
          }
        });
        return {
          staffId: sb.assignedStaffId,
          name: staff?.fullName || "Unknown Staff",
          totalBookings: sb._count.id,
          completedBookings: completedCount,
          completionRate: sb._count.id > 0 
            ? Number(((completedCount / sb._count.id) * 100).toFixed(1)) 
            : 0
        };
      })
    );

    const revenuePerService = {};
    allPayments.forEach(payment => {
      allBookings.forEach(booking => {
        booking.items.forEach(item => {
          if (booking.payments.some(bp => bp.id === payment.id)) {
            const serviceName = item.service?.name || "Unknown";
            revenuePerService[serviceName] = (revenuePerService[serviceName] || 0) + (Number(payment.amount) || 0) / (booking.items.length || 1);
          }
        });
      });
    });

    return res.json({
      success: true,
      analytics: {
        counts: {
          total: total || 0,
          pending: pending || 0,
          scheduled: scheduled || 0,
          ongoing: ongoing || 0,
          completed: completed || 0,
          cancelled: cancelled || 0
        },
        bookingTrends: {
          today: todayBookings || 0,
          thisWeek: weekBookings || 0,
          thisMonth: monthBookings || 0
        },
        finances: {
          totalRevenue: totalRevenue || 0,
          gcashRevenue: gcashRevenue || 0,
          cashRevenue: cashRevenue || 0,
          pendingRevenue: pendingRevenue || 0,
          paidBookings,
          unpaidBookings,
          averageBookingValue: total > 0 ? Number((totalRevenue / total).toFixed(2)) : 0
        },
        bookingsPerService: Object.entries(bookingsPerService)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        revenuePerService: Object.entries(revenuePerService)
          .map(([name, revenue]) => ({ name, revenue: Number(revenue.toFixed(2)) }))
          .sort((a, b) => b.revenue - a.revenue),
        peakHours,
        bookingsPerDay,
        operational: {
          cancellationRate,
          avgBookingsPerDay,
          totalDaysTracked: totalDaysWithBookings
        },
        staffAnalytics: staffWithNames.sort((a, b) => b.totalBookings - a.totalBookings)
      }
    });

  } catch (err) {
    console.error("ERROR [ADMIN_ANALYTICS]:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message
    });
  }
};

/* REQUEST DOWNPAYMENT */
const requestDownpayment = async (req, res) => {
  try {
    LOG_REQUEST(req, "REQUEST_DOWNPAYMENT");
    
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
    LOG_REQUEST(req, "GET_DAILY_SCHEDULE");
    
    const { date } = req.query;

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
    console.error("ERROR [GET_DAILY_SCHEDULE]:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// ================= ADDON REQUEST =================

const createAddonRequest = async (req, res) => {
  try {
    LOG_REQUEST(req, "CREATE_ADDON_REQUEST");
    
    const id = parseBookingId(req);
    const { services } = req.body;

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
    if (isAddonRequestUnavailable(err)) {
      return res.status(503).json({ success: false, message: "Add-on requests are not available until the database is updated" });
    }
    console.error("ADDON CREATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to create addon request" });
  }
};
const approveAddonRequest = async (req, res) => {
  try {
    LOG_REQUEST(req, "APPROVE_ADDON_REQUEST");
    
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
    if (isAddonRequestUnavailable(err)) {
      return res.status(503).json({ success: false, message: "Add-on requests are not available until the database is updated" });
    }
    console.error("APPROVE ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to approve add-on request" });
  }
};

const rejectAddonRequest = async (req, res) => {
  try {
    LOG_REQUEST(req, "REJECT_ADDON_REQUEST");
    
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
    if (isAddonRequestUnavailable(err)) {
      return res.status(503).json({ success: false, message: "Add-on requests are not available until the database is updated" });
    }
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

    if (![STATUS.PENDING, STATUS.CONFIRMED].includes(booking.status)) {
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

    if (booking.isLocked) {
      return res.status(403).json({
        success: false,
        message: "This booking can no longer be edited because the appointment time has passed"
      });
    }

    if (booking.status !== STATUS.CONFIRMED) {
      return res.status(400).json({
        success: false,
        message: "Only confirmed bookings can be edited"
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
        status: { in: [STATUS.PENDING, STATUS.CONFIRMED, STATUS.ONGOING] },
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

    let downpaymentRequired = calculateDownpayment(totalAmount);

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
          status: STATUS.PENDING
        }
      });
    });

    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: "Booking Updated",
        message: "Your booking changes were saved successfully.",
        type: "BOOKING",
        actionType: "UPDATED",
        actorId: req.user?.id || null,
        actorName: booking.customer?.fullName || "Customer",
        targetId: String(id),
        targetName: `Booking #${id}`
      }
    });

    await notifyAdminsBookingUpdated(id, "Booking Updated", `Customer ${booking.customer?.fullName || "Unknown"} updated their booking.`);

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
    LOG_REQUEST(req, "CONFIRM_DOWNPAYMENT");
    
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

    const { newAmountPaid, nextStatus } =
      getUpdatedPaymentState(booking, remainingDownpayment);

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: remainingDownpayment,
          method: "CASH",
          status: "APPROVED"
        }
      });

      const result = await tx.booking.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          status: nextStatus
        }
      });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Downpayment Verified",
          message: "Your downpayment has been verified and your booking is now confirmed.",
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
    LOG_REQUEST(req, "GET_BOOKINGS");
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

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

    const sanitizedBookings = bookings.map(booking => ({
      ...booking,
      totalAmount: booking.totalAmount ? Number(booking.totalAmount) : 0,
      amountPaid: booking.amountPaid ? Number(booking.amountPaid) : 0,
      incurredCost: booking.incurredCost ? Number(booking.incurredCost) : 0,
      refundAmount: booking.refundAmount ? Number(booking.refundAmount) : 0,
      equipmentCost: booking.equipmentCost ? Number(booking.equipmentCost) : 0,
      downpaymentAmount: booking.downpaymentAmount ? Number(booking.downpaymentAmount) : null,
      items: (booking.items || []).map(item => ({
        ...item,
        priceAtBooking: item.priceAtBooking ? Number(item.priceAtBooking) : 0
      })),
      payments: (booking.payments || []).map(payment => ({
        ...payment,
        amount: payment.amount ? Number(payment.amount) : 0
      }))
    }));

    res.json({ bookings: sanitizedBookings, success: true });
  } catch (error) {
    console.error("ERROR [GET_BOOKINGS]:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch bookings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

const getBookingById = async (req, res) => {
  try {
    LOG_REQUEST(req, "GET_BOOKING_BY_ID");
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const id = parseBookingId(req);
    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    let booking;
    try {
      booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          assignedStaff: { select: { id: true, fullName: true } },
          items: { include: { service: true } },
          payments: true
        }
      });
    } catch (dbError) {
      console.error("Database error fetching booking:", dbError);
      return res.status(500).json({ 
        success: false, 
        message: "Database error: " + (process.env.NODE_ENV === "development" ? dbError.message : "Failed to fetch booking"),
        error: process.env.NODE_ENV === "development" ? dbError.message : undefined
      });
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (req.user.role === "CUSTOMER" && String(booking.customerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Unauthorized access" });
    }

    const sanitizedBooking = {
      ...booking,
      totalAmount: booking.totalAmount ? Number(booking.totalAmount) : 0,
      amountPaid: booking.amountPaid ? Number(booking.amountPaid) : 0,
      incurredCost: booking.incurredCost ? Number(booking.incurredCost) : 0,
      refundAmount: booking.refundAmount ? Number(booking.refundAmount) : 0,
      equipmentCost: booking.equipmentCost ? Number(booking.equipmentCost) : 0,
      downpaymentAmount: booking.downpaymentAmount ? Number(booking.downpaymentAmount) : null,
      items: (booking.items || []).map(item => ({
        ...item,
        priceAtBooking: item.priceAtBooking ? Number(item.priceAtBooking) : 0
      })),
      payments: (booking.payments || []).map(payment => ({
        ...payment,
        amount: payment.amount ? Number(payment.amount) : 0
      }))
    };

    res.json({ booking: sanitizedBooking, success: true });
  } catch (error) {
    console.error("GET BOOKING BY ID ERROR:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch booking details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};
const getAddonRequests = async (req, res) => {
  try {
    LOG_REQUEST(req, "GET_ADDON_REQUESTS");
    
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
    if (isAddonRequestUnavailable(error)) {
      return res.status(503).json({ success: false, message: "Add-on requests are not available until the database is updated" });
    }
    console.error("GET ADDON REQUESTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch addon requests" });
  }
};

/* CUSTOMER REQUEST CANCEL */
const requestCustomerCancel = async (req, res) => {
  try {
    LOG_REQUEST(req, "REQUEST_CUSTOMER_CANCEL");
    
    const id = parseBookingId(req);
    const { reason } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking id" });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Cancellation reason is required" });
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
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return res.status(400).json({ success: false, message: "Cannot request cancellation for this booking" });
    }

    // Check if already requested
    if (booking.cancellationStatus === "REQUESTED") {
      return res.status(400).json({ success: false, message: "Cancellation already requested" });
    }

    if (booking.cancellationStatus === "APPROVED") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    // Create CancellationRequest and update booking in transaction
    await prisma.$transaction(async (tx) => {
      // Create CancellationRequest record
      await tx.cancellationRequest.create({
        data: {
          bookingId: id,
          requestedBy: req.user.id,
          reason: reason.trim(),
          status: "REQUESTED"
        }
      });

      // Update booking status
      await tx.booking.update({
        where: { id },
        data: {
          cancellationStatus: "REQUESTED",
          cancellationReason: reason.trim()
        }
      });
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: "Cancellation Request",
          message: `${actor?.fullName || "Customer"} requested cancellation for Booking #${id}. Reason: ${reason}`,
          type: "CANCELLATION",
          actionType: "CANCELLATION_REQUESTED",
          actorId: req.user.id,
          actorName: actor?.fullName || "Customer",
          targetId: String(id),
          targetName: `Booking #${id}`
        }
      });
    }

    // Notify customer
    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: "Cancellation Requested",
        message: `Your cancellation request for Booking #${id} has been submitted. We will review it shortly.`,
        type: "CANCELLATION",
        actionType: "CANCELLATION_REQUESTED",
        actorId: req.user.id,
        actorName: actor?.fullName || "Customer",
        targetId: String(id),
        targetName: `Booking #${id}`
      }
    });

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


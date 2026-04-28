
const prisma = require("../config/prisma");
const { Prisma } = require("@prisma/client");
const LOG_REQUEST = require("../utils/logRequest");
const statusEngine = require("../services/statusEngine.service");
const paymentService = require("../services/payment.service");
const auditService = require("../services/audit.service");
const { createAuditLog } = auditService;
const notificationQueue = require("../services/notificationQueue.service");

const createNotification = async (userId, data) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, notifyEmail: true, notifyWeb: true }
    });

    if (!user) return null;

    const hasWeb = user.notifyWeb !== false;

    if (!hasWeb) return null;

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
    return null;
  }
};

const STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  ONGOING: "ONGOING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

const SERVICE_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  FINISHED: "FINISHED"
};

const PAYMENT_STATUS = {
  UNPAID: "UNPAID",
  FOR_VERIFICATION: "FOR_VERIFICATION",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED"
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

const VALID_BOOKING_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

const VALID_SERVICE_TRANSITIONS = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["FINISHED"],
  FINISHED: []
};

const isValidTransition = (current, next) => {
  if (current === next) return true;
  return VALID_BOOKING_TRANSITIONS[current]?.includes(next) || false;
};

const notifyAdminsBookingUpdated = async (bookingId, title, message) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true }
    });
    await Promise.all(
      admins.map((admin) => 
        createNotification(admin.id, {
          title,
          message,
          type: "BOOKING",
          actionType: "BOOKING_UPDATED",
          targetId: String(bookingId),
          targetName: `Booking #${bookingId}`
        })
      )
    );
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

  // Determine PAYMENT status only — booking.status is never changed here
  let newPaymentStatus;
  if (newAmountPaid >= totalAmount && totalAmount > 0) {
    newPaymentStatus = PAYMENT_STATUS.PAID;
  } else if (newAmountPaid > 0) {
    newPaymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
  } else {
    newPaymentStatus = PAYMENT_STATUS.PENDING;
  }

  return {
    newAmountPaid,
    newPaymentStatus,
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
    const slotDuration = settings?.slotDurationMinutes ?? 60;

    const items = dbServices.map(service => ({
      serviceId: service.id,
      serviceNameAtBooking: service.name,
      priceAtBooking: Number(service.price),
      durationAtBooking: service.durationMin,
      quantity: 1
    }));

    const finalCustomerId = customerId ? String(customerId) : userId;

    const booking = await prisma.$transaction(async (tx) => {
      // Use the same fixed slot window as the availability endpoint
      // so that what appears "available" can actually be booked
      const slotEnd = new Date(appointmentStart.getTime() + slotDuration * 60000);

      const existingBookingsCount = await tx.booking.count({
        where: {
          appointmentStart: { lt: slotEnd },
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
          paymentStatus: PAYMENT_STATUS.UNPAID,
          serviceStatus: SERVICE_STATUS.NOT_STARTED,
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
          title: "Booking Received",
          message: `Your booking for ${appointmentStart.toLocaleDateString()} has been received. Please wait for confirmation.`,
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

    // Audit log for booking creation
    await createAuditLog({
      userId: finalCustomerId,
      action: "CREATE",
      entityType: "Booking",
      entityId: String(booking.id),
      newValue: {
        status: booking.status,
        totalAmount: parsedTotalAmount,
        paymentMethod: normalizedPaymentMethod,
        appointmentStart: appointmentStart.toISOString()
      },
      details: `New booking #${booking.id} created by customer for ${appointmentStart.toLocaleDateString()}. Total: ₱${parsedTotalAmount.toLocaleString()}`,
      bookingId: booking.id,
      performedBy: finalCustomerId
    });

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

    if (booking.status === STATUS.CANCELLED || booking.status === STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a booking that is already cancelled or completed"
      });
    }

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    const result = await statusEngine.transitionBooking(id, STATUS.CANCELLED, req.user.id, {
      reason: "Admin direct cancellation",
      cancellationStatus: "APPROVED"
    });

    res.json({
      success: true,
      booking: result
    });

  } catch (error) {
    console.error("ERROR [CANCEL_BOOKING]:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
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

    // Allow assignment for PENDING, CONFIRMED, or ONGOING bookings
    const assignableStatuses = [STATUS.PENDING, STATUS.CONFIRMED, STATUS.ONGOING];
    if (!assignableStatuses.includes(booking.status)) {
      return res.status(400).json({ success: false, message: "Staff can only be assigned to active bookings" });
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

      const availableStaffResults = await Promise.all(
        staffList.map(async (staff) => {
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
            return { staff, workload };
          }
          return null;
        })
      );

      availableStaff = availableStaffResults.filter(r => r !== null);

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
    const previousStaffId = booking.assignedStaffId ? String(booking.assignedStaffId) : null;
    const newStaffId = assignedStaffId ? String(assignedStaffId) : null;
    
    if (previousStaffId === newStaffId) {
      return res.json({ 
        success: true, 
        message: "Staff is already assigned to this booking",
        booking: booking
      });
    }

    const isReassignment = !!previousStaffId;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Perform Update
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { assignedStaffId: String(assignedStaffId) },
        include: { 
          assignedStaff: { select: { fullName: true } }, 
          customer: { select: { id: true, fullName: true } } 
        }
      });

      // 2. Notifications (Safely wrapped)
      const notify = async (userId, title, message) => {
        try {
          if (!userId) return;
          await tx.notification.create({
            data: {
              userId: String(userId),
              title,
              message,
              type: "BOOKING",
              targetId: String(id)
            }
          });
        } catch (nErr) {
          console.warn(`[ASSIGN_STAFF] Notification failed for ${userId}:`, nErr.message);
        }
      };

      await Promise.all([
        notify(updatedBooking.customer?.id, isReassignment ? "Staff Reassigned" : "Staff Assigned", "A detailer has been assigned to your booking."),
        notify(String(assignedStaffId), isReassignment ? "Task Updated" : "New Task", `You have been assigned to Booking #${id}`)
      ]);

      // 3. Audit Log (Safely wrapped)
      await auditService.logAction(tx, {
        userId: req.user.id,
        action: isReassignment ? "STAFF_REASSIGNED" : "STAFF_ASSIGNED",
        entityType: "Booking",
        entityId: String(id),
        oldValue: { assignedStaff: previousStaffId || "Unassigned" },
        newValue: { assignedStaff: updatedBooking.assignedStaff?.fullName || "Assigned" },
        details: `Staff assignment updated for booking #${id}`,
        bookingId: id
      });

      return updatedBooking;
    });

    return res.json({ 
      success: true, 
      message: "Staff assigned successfully", 
      booking: result 
    });

  } catch (error) {
    console.error("ASSIGN STAFF FATAL ERROR:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to assign staff",
      error: error.message,
      stack: error.stack
    });
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

    const actor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { fullName: true }
    });

    const actorRole = String(req.user.role || "").toUpperCase();

    // Locked bookings cannot be modified
    if (booking.status === STATUS.COMPLETED || booking.status === STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify completed or cancelled booking"
      });
    }

    // Only admins can change booking status
    if (!isPrivilegedRole(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can change booking status. Staff should use the service-status endpoint."
      });
    }

    // Validate the requested status
    // 1. Validate requested status
    const allowedStatuses = [STATUS.CANCELLED, STATUS.ONGOING, STATUS.COMPLETED];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Admins can only change status to: ${allowedStatuses.join(", ")}`
      });
    }

    // 2. Delegate transition to statusEngine
    try {
      const updatedBooking = await statusEngine.transitionBooking(id, status, req.user.id, {
        reason: req.body.adminNote || `Admin manual status update to ${status}`
      });

      return res.json({ 
        success: true, 
        message: `Booking status updated to ${status}`, 
        booking: updatedBooking 
      });

    } catch (engineError) {
      console.error("STATUS_ENGINE ERROR:", engineError.message);
      return res.status(400).json({ 
        success: false, 
        message: engineError.message 
      });
    }


  } catch (error) {
    console.error("UPDATE_BOOKING_STATUS ERROR:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message,
      stack: error.stack
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

    const { newAmountPaid, newPaymentStatus } =
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
          paymentStatus: newPaymentStatus
          // booking.status intentionally NOT changed here
        }
      });

      const actor = await tx.user.findUnique({ where: { id: req.user?.id } });
      const remaining = (Number(booking.totalAmount) || 0) - newAmountPaid;
      let paymentMessage = `Payment of ₱${paymentAmount.toLocaleString()} received. `;
      
      if (newPaymentStatus === PAYMENT_STATUS.PAID) {
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



      return updatedBooking;
    });

    await createAuditLog({
      userId: req.user.id,
      action: "PAYMENT_RECORDED",
      entityType: "Booking",
      entityId: String(id),
      oldValue: { amountPaid: Number(booking.amountPaid), paymentStatus: booking.paymentStatus },
      newValue: { amountPaid: Number(updated.amountPaid), paymentStatus: updated.paymentStatus },
      details: `Manual payment of ₱${paymentAmount.toLocaleString()} recorded. Total paid: ₱${Number(updated.amountPaid).toLocaleString()}`,
      bookingId: id,
      performedBy: req.user.id
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

    const { newAmountPaid, newPaymentStatus } =
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
          paymentStatus: newPaymentStatus
          // booking.status intentionally NOT changed here
        }
      });

      const actor = await tx.user.findUnique({ where: { id: req.user?.id } });
      const remaining = (Number(booking.totalAmount) || 0) - newAmountPaid;
      let paymentMessage = `Payment of ₱${paymentAmount.toLocaleString()} received. `;
      
      if (newPaymentStatus === PAYMENT_STATUS.PAID) {
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



      return updatedBooking;
    });

    await createAuditLog({
      userId: req.user.id,
      action: "PAYMENT_ADDED",
      entityType: "Booking",
      entityId: String(id),
      oldValue: { amountPaid: Number(booking.amountPaid), paymentStatus: booking.paymentStatus },
      newValue: { amountPaid: Number(result.amountPaid), paymentStatus: result.paymentStatus },
      details: `Admin added payment of ₱${paymentAmount.toLocaleString()}. Total paid: ₱${Number(result.amountPaid).toLocaleString()}`,
      bookingId: id,
      performedBy: req.user.id
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
    const _analyticsStart = Date.now();
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const range = String(req.query.range || "month").toLowerCase();
    const rangeStart = range === "today"
      ? startOfToday
      : range === "week"
        ? startOfWeek
        : range === "month"
          ? startOfMonth
          : null;

    const bookingRangeWhere = rangeStart
      ? { appointmentStart: { gte: rangeStart } }
      : {};
    const paymentRangeWhere = rangeStart
      ? { createdAt: { gte: rangeStart } }
      : {};

    // 1. Basic Counts (Parallelized)
    const [
      totalCount,
      statusCounts,
      serviceStatusCounts,
      paymentStatusCounts,
      todayCount,
      weekCount,
      monthCount
    ] = await Promise.all([
      prisma.booking.count({ where: bookingRangeWhere }),
      prisma.booking.groupBy({
        by: ['status'],
        _count: true,
        where: bookingRangeWhere
      }),
      prisma.booking.groupBy({
        by: ['serviceStatus'],
        _count: true,
        where: bookingRangeWhere
      }),
      prisma.booking.groupBy({
        by: ['paymentStatus'],
        _count: true,
        where: bookingRangeWhere
      }),
      prisma.booking.count({ where: { appointmentStart: { gte: startOfToday } } }),
      prisma.booking.count({ where: { appointmentStart: { gte: startOfWeek } } }),
      prisma.booking.count({ where: { appointmentStart: { gte: startOfMonth } } })
    ]);

    // Map status counts for easy access
    const counts = {
      booking: { PENDING: 0, CONFIRMED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 },
      service: { NOT_STARTED: 0, IN_PROGRESS: 0, FINISHED: 0 },
      payment: { UNPAID: 0, FOR_VERIFICATION: 0, PARTIALLY_PAID: 0, PAID: 0, REJECTED: 0, FAILED: 0 }
    };

    statusCounts.forEach(c => {
      if (counts.booking[c.status] !== undefined) counts.booking[c.status] = c._count;
    });
    serviceStatusCounts.forEach(c => {
      if (counts.service[c.serviceStatus] !== undefined) counts.service[c.serviceStatus] = c._count;
    });
    paymentStatusCounts.forEach(c => {
      if (counts.payment[c.paymentStatus] !== undefined) counts.payment[c.paymentStatus] = c._count;
    });

    // 2. Revenue Aggregations (Database-side)
    const [
      revenueData,
      paymentMethodData,
      unpaidData,
      monthRevenueData
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: "PAID", ...paymentRangeWhere },
        _sum: { amount: true }
      }),
      prisma.payment.groupBy({
        where: { status: "PAID", ...paymentRangeWhere },
        by: ['method'],
        _sum: { amount: true }
      }),
      prisma.booking.aggregate({
        where: {
          status: { notIn: ["CANCELLED", "COMPLETED"] },
          ...bookingRangeWhere
        },
        _sum: { totalAmount: true, amountPaid: true }
      }),
      prisma.payment.aggregate({
        where: { 
          status: "PAID",
          createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true }
      })
    ]);

    const totalRevenue = Number(revenueData._sum?.amount || 0);
    const monthRevenue = Number(monthRevenueData._sum?.amount || 0);
    const gcashRevenue = paymentMethodData
      .filter(p => p.method === "GCASH" || p.method === "GCASH_POST_SERVICE")
      .reduce((sum, p) => sum + (Number(p._sum?.amount || 0)), 0);
    const cashRevenue = paymentMethodData
      .filter(p => p.method === "CASH")
      .reduce((sum, p) => sum + (Number(p._sum?.amount || 0)), 0);

    const pendingRevenue = (Number(unpaidData._sum?.totalAmount || 0)) - (Number(unpaidData._sum?.amountPaid || 0));

    // 3. Service & Operational Analytics (Full Dataset — No Sampling)
    const [
      bookingsPerServiceData,
      revenuePerServiceData,
      peakHoursData
    ] = await Promise.all([
      // Service frequency: full dataset via groupBy
      prisma.bookingItem.groupBy({
        by: ['serviceNameAtBooking'],
        _count: { id: true },
        where: {
          booking: {
            status: { not: "CANCELLED" },
            ...(rangeStart ? { appointmentStart: { gte: rangeStart } } : {})
          }
        }
      }),
      // Revenue per service: aggregate paid payments grouped by service name
      prisma.$queryRaw`
        SELECT bi."serviceNameAtBooking" AS name,
               COALESCE(SUM(p.amount), 0) AS revenue
        FROM "BookingItem" bi
        JOIN "Booking" b ON bi."bookingId" = b.id
        LEFT JOIN "Payment" p ON p."bookingId" = b.id AND p.status::text = 'PAID'
        WHERE b.status::text != 'CANCELLED'
          ${rangeStart ? Prisma.sql`AND b."appointmentStart" >= ${rangeStart}` : Prisma.empty}
        GROUP BY bi."serviceNameAtBooking"
        ORDER BY revenue DESC
      `,
      // Peak hours: full dataset via raw SQL for hour extraction
      prisma.$queryRaw`
        SELECT EXTRACT(HOUR FROM "appointmentStart")::int AS hour,
               COUNT(*)::int AS count
        FROM "Booking"
        WHERE status::text != 'CANCELLED' AND "appointmentStart" IS NOT NULL
          ${rangeStart ? Prisma.sql`AND "appointmentStart" >= ${rangeStart}` : Prisma.empty}
        GROUP BY hour
        ORDER BY count DESC
        LIMIT 5
      `
    ]);

    const bookingsPerService = bookingsPerServiceData
      .map(b => ({ name: b.serviceNameAtBooking || "Unknown", count: b._count.id }))
      .sort((a, b) => b.count - a.count);

    const revenuePerService = (revenuePerServiceData || [])
      .map(r => ({ name: r.name || "Unknown", revenue: Number(Number(r.revenue || 0).toFixed(2)) }))
      .filter(r => r.revenue > 0);

    const peakHours = (peakHoursData || [])
      .slice(0, 3)
      .map(row => ({
        hour: Number(row.hour),
        count: Number(row.count),
        label: `${row.hour}:00`
      }));

    const distributionStart = rangeStart || startOfMonth;
    const monthDistribution = await prisma.$queryRaw`
      SELECT EXTRACT(DAY FROM "appointmentStart")::int AS day,
             COUNT(*)::int AS count
      FROM "Booking"
      WHERE "appointmentStart" IS NOT NULL
        AND "appointmentStart" >= ${distributionStart}
        AND status::text != 'CANCELLED'
      GROUP BY day
    `;

    const bookingsPerDay = {};
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      bookingsPerDay[i] = 0;
    }
    (monthDistribution || []).forEach((row) => {
      if (row.day) {
        bookingsPerDay[row.day] = Number(row.count || 0);
      }
    });

    const totalDaysInMonth = Object.values(bookingsPerDay).filter(v => v > 0).length;
    const avgBookingsPerDay = totalDaysInMonth > 0 
      ? Number((monthCount / totalDaysInMonth).toFixed(1)) 
      : 0;

    const cancellationRate = totalCount > 0 
      ? Number(((counts.booking.CANCELLED / totalCount) * 100).toFixed(1)) 
      : 0;

    const staffTotals = await prisma.$queryRaw`
      SELECT b."assignedStaffId" AS "staffId",
             COUNT(*)::int AS total,
             SUM(CASE WHEN b.status::text = 'COMPLETED' THEN 1 ELSE 0 END)::int AS completed
      FROM "Booking" b
      WHERE b."assignedStaffId" IS NOT NULL
        ${rangeStart ? Prisma.sql`AND b."appointmentStart" >= ${rangeStart}` : Prisma.empty}
      GROUP BY b."assignedStaffId"
    `;

    const staffIds = (staffTotals || []).map((row) => row.staffId);
    const staffDetails = staffIds.length
      ? await prisma.user.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, fullName: true }
        })
      : [];

    const staffMap = {};
    staffDetails.forEach((staff) => {
      staffMap[staff.id] = staff.fullName;
    });

    const staffWithNames = (staffTotals || []).map((row) => {
      const total = Number(row.total || 0);
      const completed = Number(row.completed || 0);
      return {
        id: row.staffId,
        name: staffMap[row.staffId] || "Unknown",
        totalBookings: total,
        completedBookings: completed,
        completionRate: total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0
      };
    });

    // AI Revenue Forecast Logic
    const today = new Date();
    const currentDay = today.getDate();
    
    const projectedRevenue = currentDay > 0 
      ? (monthRevenue / currentDay) * daysInMonth 
      : 0;
    
    // Growth compared to current total (this is just an example, could compare to prev month)
    const projectedGrowth = totalRevenue > 0 
      ? ((projectedRevenue - (totalRevenue / 12)) / (totalRevenue / 12) * 100).toFixed(1)
      : 0;

    const forecast = {
      projectedRevenue: Number(projectedRevenue.toFixed(2)),
      projectedGrowth: Number(projectedGrowth),
      confidenceScore: currentDay > 20 ? 90 : currentDay > 10 ? 75 : 50
    };

    res.json({
      success: true,
      analytics: {
        counts: {
          total: totalCount,
          booking: counts.booking,
          service: counts.service,
          payment: counts.payment,
          // Legacy support (to avoid breaking current UI before update)
          pending: counts.booking.PENDING,
          confirmed: counts.booking.CONFIRMED,
          ongoing: counts.booking.ONGOING,
          completed: counts.booking.COMPLETED,
          cancelled: counts.booking.CANCELLED,
        },
        forecast,
        bookingTrends: {
          today: todayCount,
          thisWeek: weekCount,
          thisMonth: monthCount
        },
        finances: {
          totalRevenue,
          gcashRevenue,
          cashRevenue,
          pendingRevenue,
          paidBookings: counts.booking.COMPLETED,
          unpaidBookings: totalCount - counts.booking.COMPLETED
        },
        operational: {
          avgBookingsPerDay,
          cancellationRate,
          totalDaysTracked: totalDaysInMonth
        },
        peakHours,
        bookingsPerService,
        revenuePerService,
        bookingsPerDay,
        staffAnalytics: staffWithNames
      }
    });
    console.log(`[PERF] getAdminAnalytics took: ${Date.now() - _analyticsStart}ms`);
  } catch (error) {
    console.error("GET_ADMIN_ANALYTICS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin analytics",
      error: error.message,
      stack: error.stack
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

    // Allow staff to request cancel for CONFIRMED/PENDING bookings
    const staffCancellableStatuses = [STATUS.PENDING, STATUS.CONFIRMED];
    if (!staffCancellableStatuses.includes(booking.status)) {
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

    // Allow editing for CONFIRMED/PENDING bookings
    const editableStatuses = [STATUS.PENDING, STATUS.CONFIRMED];
    if (!editableStatuses.includes(booking.status)) {
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
        status: { in: [STATUS.PENDING, STATUS.CONFIRMED] },
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

    const slotDuration = settings?.slotDurationMinutes ?? 60;

    const overlappingBookings = await prisma.booking.count({
      where: {
        id: { not: id },
        appointmentStart: { lt: new Date(start.getTime() + slotDuration * 60000) },
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

    const { newAmountPaid, newPaymentStatus } =
      getUpdatedPaymentState(booking, remainingDownpayment);

    const actor = await prisma.user.findUnique({ where: { id: req.user?.id } });

    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId: id,
          amount: remainingDownpayment,
          method: "CASH",
          status: "PAID" // Use PAID for verified downpayments
        }
      });

      // Sync booking via status engine (internal sync method)
      await statusEngine._syncBookingPaymentStatus(tx, id);
      
      return await tx.booking.findUnique({ where: { id } });
    });

    res.json({
      success: true,
      message: "Downpayment verified successfully",
      booking: updated
    });
  } catch (error) {
    console.error("CONFIRM DOWNPAYMENT ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to verify downpayment"
    });
  }
};

const getBookings = async (req, res) => {
  try {
    LOG_REQUEST(req, "GET_BOOKINGS");
    const _queryStart = Date.now();

    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const role = req.user.role;
    const userId = String(req.user.id);
    let { status, page = 1, limit = 15 } = req.query;
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(50, Math.max(1, parseInt(limit) || 15));
    const skip = (page - 1) * limit;

    let where = {};
    if (status) {
      where.status = status;
    }

    if (role === "CUSTOMER") {
      where.customerId = userId;
    } else if (role === "STAFF") {
      where.assignedStaffId = userId;
    }

    const [totalCount, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          serviceStatus: true,
          totalAmount: true,
          amountPaid: true,
          appointmentStart: true,
          appointmentEnd: true,
          vehicleType: true,
          plateNumber: true,
          vehicleBrand: true,
          vehicleModel: true,
          createdAt: true,
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          assignedStaff: { select: { id: true, fullName: true } },
          items: { select: { serviceNameAtBooking: true, priceAtBooking: true } },
          payments: { select: { amount: true, status: true } }
        },
        orderBy: { appointmentStart: "desc" },
        skip,
        take: limit
      })
    ]);

    const sanitizedBookings = bookings.map(booking => {
      // Compute totalPaid from payments array server-side, then drop the array
      const totalPaid = (booking.payments || []).reduce((sum, p) => {
        if (p.status === "PAID" || p.status === "APPROVED" || p.status === "VERIFIED" || p.status === "COMPLETED") {
          return sum + Number(p.amount || 0);
        }
        return sum;
      }, 0);
      const { payments, ...rest } = booking;
      return {
        ...rest,
        totalAmount: Number(booking.totalAmount || 0),
        amountPaid: Number(booking.amountPaid || 0),
        totalPaid,
        items: (booking.items || []).map(item => ({
          ...item,
          priceAtBooking: Number(item.priceAtBooking || 0)
        }))
      };
    });

    res.json({ 
      success: true, 
      bookings: sanitizedBookings,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
    console.log(`[PERF] getBookings took: ${Date.now() - _queryStart}ms (${sanitizedBookings.length} results)`);
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
    const _queryStart = Date.now();

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // ✅ FIX: replace parseBookingId (this was your bug source)
    const id = Number(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    let booking;

    try {
      booking = await prisma.booking.findUnique({
        where: { id },
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
        }
      });
    } catch (dbError) {
      console.error("Database error fetching booking:", dbError);
      return res.status(500).json({
        success: false,
        message: "Database error",
        error:
          process.env.NODE_ENV === "development"
            ? dbError.message
            : undefined
      });
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // role protection
    if (
      req.user.role === "CUSTOMER" &&
      String(booking.customerId) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access"
      });
    }

    const sanitizedBooking = {
      ...booking,
      totalAmount: booking.totalAmount ? Number(booking.totalAmount) : 0,
      amountPaid: booking.amountPaid ? Number(booking.amountPaid) : 0,
      incurredCost: booking.incurredCost ? Number(booking.incurredCost) : 0,
      refundAmount: booking.refundAmount ? Number(booking.refundAmount) : 0,
      equipmentCost: booking.equipmentCost ? Number(booking.equipmentCost) : 0,
      downpaymentAmount: booking.downpaymentAmount
        ? Number(booking.downpaymentAmount)
        : null,
      items: (booking.items || []).map(item => ({
        ...item,
        priceAtBooking: item.priceAtBooking
          ? Number(item.priceAtBooking)
          : 0
      })),
      payments: (booking.payments || []).map(payment => ({
        ...payment,
        amount: payment.amount ? Number(payment.amount) : 0
      }))
    };

    res.json({ booking: sanitizedBooking, success: true });
    console.log(`[PERF] getBookingById took: ${Date.now() - _queryStart}ms`);
  } catch (error) {
    console.error("GET BOOKING BY ID ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking details",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined
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

    const canDirectCancel = booking.status === STATUS.PENDING;

    // Create CancellationRequest and update booking in transaction
    const result = await prisma.$transaction(async (tx) => {
      if (canDirectCancel) {
        // Direct Cancel
        const updated = await tx.booking.update({
          where: { id },
          data: {
            status: STATUS.CANCELLED,
            cancellationStatus: "APPROVED",
            cancelledAt: new Date(),
            cancelledBy: req.user.id,
            cancellationReason: reason.trim()
          }
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: "DIRECT_CANCEL",
            entityType: "Booking",
            entityId: String(id),
            oldValue: JSON.stringify({ status: booking.status }),
            newValue: JSON.stringify({ status: STATUS.CANCELLED }),
            details: "Customer performed direct cancellation for pending booking",
            bookingId: id,
            performedBy: req.user.id
          }
        });

        return { direct: true, updated };
      } else {
        // Request Cancel
        await tx.cancellationRequest.create({
          data: {
            bookingId: id,
            requestedBy: req.user.id,
            reason: reason.trim(),
            status: "REQUESTED"
          }
        });

        const updated = await tx.booking.update({
          where: { id },
          data: {
            cancellationStatus: "REQUESTED",
            cancellationReason: reason.trim()
          }
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: "REQUEST_CANCEL",
            entityType: "Booking",
            entityId: String(id),
            oldValue: JSON.stringify({ cancellationStatus: booking.cancellationStatus }),
            newValue: JSON.stringify({ cancellationStatus: "REQUESTED" }),
            details: "Customer requested cancellation for confirmed booking",
            bookingId: id,
            performedBy: req.user.id
          }
        });

        return { direct: false, updated };
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

const processCancellationRequest = async (req, res) => {
  try {
    LOG_REQUEST(req, "PROCESS_CANCELLATION_REQUEST");
    
    const id = Number(req.params.id);
    const { action, adminNote } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action. Must be 'approve' or 'reject'." });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.cancellationStatus !== "REQUESTED") {
      return res.status(400).json({ success: false, message: "No pending cancellation request for this booking" });
    }

    const isApproval = action === "approve";

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the request record
      await tx.cancellationRequest.updateMany({
        where: { bookingId: id, status: "REQUESTED" },
        data: {
          status: isApproval ? "APPROVED" : "REJECTED",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          adminNote: adminNote || (isApproval ? "Admin approved cancellation" : "Admin rejected cancellation")
        }
      });

      if (isApproval) {
        // Use status engine for approval (handles all side effects)
        return await statusEngine.transitionBooking(id, STATUS.CANCELLED, req.user.id, {
          tx, // Pass current transaction
          reason: adminNote || "Admin approved cancellation",
          cancellationStatus: "APPROVED"
        });
      } else {
        // Just update booking meta for rejection
        const updated = await tx.booking.update({
          where: { id },
          data: { cancellationStatus: "REJECTED" }
        });

        // Manual notification for rejection since status doesn't change
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            title: "Cancellation Request Rejected",
            message: `Your cancellation request for Booking #${id} was not approved.`,
            type: "CANCELLATION",
            actionType: "CANCELLATION_REJECTED",
            targetId: String(id)
          }
        });

        return updated;
      }
    });

    return res.json({ 
      success: true, 
      message: `Cancellation request ${action}ed successfully`,
      booking: result
    });
  } catch (error) {
    console.error("PROCESS CANCELLATION REQUEST ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

const getAdminBookings = async (req, res) => {
  try {
    let {
      status,
      paymentStatus,
      serviceStatus,
      search = "",
      searchTerm = "",
      includeTotal = "true",
      page = 1,
      limit = 20
    } = req.query;

    page = Math.max(1, Number(page) || 1);
    limit = Math.min(50, Math.max(1, Number(limit) || 20));
    const shouldCount = String(includeTotal).toLowerCase() !== "false";

    const where = {};

    if (status) where.status = String(status).toUpperCase();
    if (paymentStatus) where.paymentStatus = String(paymentStatus).toUpperCase();
    if (serviceStatus) where.serviceStatus = String(serviceStatus).toUpperCase();

    const rawSearch = String(searchTerm || search).trim();
    const numericSearch = rawSearch && /^[0-9]+$/.test(rawSearch) ? Number(rawSearch) : null;
    const textSearch = rawSearch.length >= 2 ? rawSearch : "";

    if (numericSearch !== null || textSearch) {
      where.OR = [
        numericSearch !== null ? { id: numericSearch } : null,
        textSearch ? { customer: { fullName: { contains: textSearch, mode: "insensitive" } } } : null,
        textSearch ? { customer: { email: { contains: textSearch, mode: "insensitive" } } } : null,
        textSearch ? { plateNumber: { contains: textSearch, mode: "insensitive" } } : null,
        textSearch ? { vehicleBrand: { contains: textSearch, mode: "insensitive" } } : null,
        textSearch ? { vehicleModel: { contains: textSearch, mode: "insensitive" } } : null
      ].filter(Boolean);
    }

    const [rows, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          appointmentStart: "desc"
        },
        select: {
          id: true,
          totalAmount: true,
          paymentStatus: true,
          serviceStatus: true,
          appointmentStart: true,
          vehicleType: true,
          plateNumber: true,

          customer: {
            select: {
              fullName: true,
              phone: true
            }
          }
        }
      }),
      shouldCount ? prisma.booking.count({ where }) : Promise.resolve(null)
    ]);

    const resolvedTotal = shouldCount ? total : rows.length;

    res.json({
      success: true,
      bookings: rows,
      pagination: {
        page,
        limit,
        total: resolvedTotal,
        pages: resolvedTotal ? Math.ceil(resolvedTotal / limit) : 0
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

/* ============================================================
   UPDATE SERVICE STATUS (Staff & Admin Only)
   - NOT_STARTED → ONGOING  (Start Service)
   - ONGOING → COMPLETED    (Finish Service)
============================================================ */
const updateServiceStatus = async (req, res) => {
  try {
    LOG_REQUEST(req, "UPDATE_SERVICE_STATUS");
    const id = parseBookingId(req);
    const { serviceStatus, metadata } = req.body;

    if (!id) return res.status(400).json({ success: false, message: "Invalid booking id" });

    const updatedBooking = await statusEngine.transitionService(id, serviceStatus, req.user.id, metadata);

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error("UPDATE_SERVICE_STATUS ERROR:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Admin Override for Booking Completion
 */
const adminOverride = async (req, res) => {
  try {
    LOG_REQUEST(req, "ADMIN_OVERRIDE");
    const id = parseBookingId(req);
    const { reason } = req.body;

    if (!id) return res.status(400).json({ success: false, message: "Invalid booking id" });
    if (!reason) return res.status(400).json({ success: false, message: "Reason is required for override" });

    if (!isPrivilegedRole(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id },
        data: { 
          status: "COMPLETED",
          isLocked: true,
          adminOverrideBy: req.user.id,
          adminOverrideAt: new Date(),
          adminOverrideReason: reason,
          overrideUsed: true
        }
      });

      const auditService = require("../services/audit.service");
      await auditService.logAction(tx, {
        bookingId: id,
        userId: req.user.id,
        action: "ADMIN_OVERRIDE_COMPLETION",
        entityType: "BOOKING",
        entityId: id.toString(),
        oldValue: { status: booking.status },
        newValue: { status: "COMPLETED", isLocked: true },
        details: `Admin override: Completion forced without full payment. Reason: ${reason}`
      });

      return booking;
    });

    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error("ADMIN_OVERRIDE ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
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
  updateServiceStatus,
  recordPayment,
  confirmDownpayment,
  addPayment,
  requestDownpayment,
  addServiceToBooking,
  getAvailability,
  getAdminAnalytics,
  getAdminBookings,
  getDailySchedule,
  createAddonRequest,
  getAddonRequests,
  updateBooking,
  approveAddonRequest,
  approveAddonRequest,
  rejectAddonRequest,
  requestCancelBooking,
  processCancellationRequest,
  adminOverride
};


const prisma = require("../config/prisma");

/* =========================
   Helpers
========================= */
function parseBookingId(req) {
  const bookingId = Number(req.params.id);
  return Number.isInteger(bookingId) ? bookingId : null;
}

function normalizeServiceItems(services) {
  // Accept:
  // 1) [1, 3, 5]
  // 2) [{ serviceId: 1, quantity: 2 }, ...]
  const items = (services || [])
    .map((s) => {
      if (typeof s === "number") return { serviceId: s, quantity: 1 };
      const serviceId = Number(s?.serviceId);
      const quantity = Number(s?.quantity ?? 1);
      return {
        serviceId: Number.isInteger(serviceId) ? serviceId : null,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      };
    })
    .filter((x) => Number.isInteger(x.serviceId));

  return items;
}

/* =========================
   CREATE BOOKING (Customer)
========================= */
const createBooking = async (req, res) => {
  try {
    const { services, appointmentStart, appointmentEnd } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const serviceItems = normalizeServiceItems(services);

    if (!serviceItems.length || !appointmentStart || !appointmentEnd) {
      return res.status(400).json({
        message: "services array, appointmentStart and appointmentEnd are required",
      });
    }

    const start = new Date(appointmentStart);
    const end = new Date(appointmentEnd);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid appointmentStart/appointmentEnd" });
    }
    if (end <= start) {
      return res.status(400).json({ message: "appointmentEnd must be after appointmentStart" });
    }

    // Check overlapping bookings (global overlap)
    // Optional improvement later: check by staff only, or by number of bays.
    const overlapping = await prisma.booking.findFirst({
      where: {
        status: { not: "CANCELLED" },
        appointmentStart: { lt: end },
        appointmentEnd: { gt: start },
      },
    });

    if (overlapping) {
      return res.status(400).json({ message: "Selected time slot is already booked" });
    }

    // Fetch services from DB
    const serviceIds = serviceItems.map((s) => s.serviceId);

    const dbServices = await prisma.service.findMany({
      where: { id: { in: serviceIds }, active: true },
      select: { id: true, price: true, durationMin: true, name: true },
    });

    if (dbServices.length !== serviceIds.length) {
      return res.status(400).json({ message: "One or more services invalid" });
    }

    // Calculate total and items
    let totalAmount = 0;

    const bookingItemsData = serviceItems.map((item) => {
      const service = dbServices.find((s) => s.id === item.serviceId);
      const quantity = item.quantity || 1;
      const itemTotal = service.price * quantity;
      totalAmount += itemTotal;

      return {
        serviceId: service.id,
        price: service.price,
        quantity,
      };
    });

    // Create booking + items (nested create)
    const booking = await prisma.booking.create({
      data: {
        customerId: userId,
        appointmentStart: start,
        appointmentEnd: end,
        totalAmount,
        items: { create: bookingItemsData },
      },
      include: {
        customer: true,
        assignedStaff: true,
        items: { include: { service: true } },
        payments: true,
      },
    });

    // Optional notification
    await prisma.notification.create({
      data: {
        userId,
        title: "Booking Created",
        message: `Your booking #${booking.id} has been created and is pending.`,
        type: "BOOKING",
      },
    });

    return res.json({ message: "Booking created successfully", booking });
  } catch (error) {
    console.error("CREATE BOOKING ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   GET BOOKINGS (Role-based)
========================= */
const getBookings = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const baseInclude = {
      customer: true,
      assignedStaff: true,
      items: { include: { service: true } },
      payments: true,
    };

    // Admins: see all bookings
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
      const bookings = await prisma.booking.findMany({
        include: baseInclude,
        orderBy: { createdAt: "desc" },
      });
      return res.json(bookings);
    }

    // Customers: only own bookings
    if (userRole === "CUSTOMER") {
      const bookings = await prisma.booking.findMany({
        where: { customerId: userId },
        include: baseInclude,
        orderBy: { createdAt: "desc" },
      });
      return res.json(bookings);
    }

    // Staff: only assigned bookings
    if (userRole === "STAFF") {
      const bookings = await prisma.booking.findMany({
        where: { assignedStaffId: userId },
        include: baseInclude,
        orderBy: { createdAt: "desc" },
      });
      return res.json(bookings);
    }

    return res.status(403).json({ message: "Forbidden" });
  } catch (error) {
    console.error("GET BOOKINGS ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   UPDATE BOOKING STATUS
========================= */
const updateBookingStatus = async (req, res) => {
  try {
    const bookingId = parseBookingId(req);
    const { status } = req.body;

    if (!bookingId) return res.status(400).json({ message: "Invalid booking id" });
    if (!status) return res.status(400).json({ message: "status is required" });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!userRole || !userId) return res.status(401).json({ message: "Unauthorized" });

    // ADMIN: only PENDING -> SCHEDULED
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
      if (booking.status === "PENDING" && status === "SCHEDULED") {
        const updated = await prisma.booking.update({
          where: { id: bookingId },
          data: { status },
        });

        await prisma.notification.create({
          data: {
            userId: booking.customerId,
            title: "Booking Scheduled",
            message: `Your booking #${bookingId} has been scheduled.`,
            type: "BOOKING",
          },
        });

        return res.json({ message: "Booking scheduled successfully", booking: updated });
      }

      return res.status(400).json({
        message: "Admin can only move PENDING → SCHEDULED",
      });
    }

    // STAFF: must be assigned, then SCHEDULED->ONGOING, ONGOING->COMPLETED (paid)
    if (userRole === "STAFF") {
      if (booking.assignedStaffId !== userId) {
        return res.status(403).json({ message: "Forbidden: not assigned to this booking" });
      }

      if (booking.status === "SCHEDULED" && status === "ONGOING") {
        const updated = await prisma.booking.update({
          where: { id: bookingId },
          data: { status },
        });

        await prisma.notification.create({
          data: {
            userId: booking.customerId,
            title: "Service Started",
            message: `Your booking #${bookingId} is now ongoing.`,
            type: "BOOKING",
          },
        });

        return res.json({ message: "Booking started", booking: updated });
      }

      if (booking.status === "ONGOING" && status === "COMPLETED") {
        if (booking.paymentStatus !== "PAID") {
          return res.status(400).json({
            message: "Booking must be fully paid before completion",
          });
        }

        const updated = await prisma.booking.update({
          where: { id: bookingId },
          data: { status },
        });

        await prisma.notification.create({
          data: {
            userId: booking.customerId,
            title: "Booking Completed",
            message: `Your booking #${bookingId} has been completed. Thank you!`,
            type: "BOOKING",
          },
        });

        return res.json({ message: "Booking completed", booking: updated });
      }

      return res.status(400).json({ message: "Invalid status transition for staff" });
    }

    return res.status(403).json({ message: "Forbidden" });
  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   RECORD PAYMENT
========================= */
const recordPayment = async (req, res) => {
  try {
    const bookingId = parseBookingId(req);
    const { amount, method } = req.body;

    if (!bookingId) return res.status(400).json({ message: "Invalid booking id" });

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: "Valid payment amount required" });
    }

    // method is optional; default handled by Prisma schema
    if (method && !["CASH", "GCASH"].includes(method)) {
      return res.status(400).json({ message: "method must be CASH or GCASH" });
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.status === "CANCELLED") {
      return res.status(400).json({ message: "Cannot pay a cancelled booking" });
    }

    const remainingBalance = booking.totalAmount - booking.amountPaid;

    if (amt > remainingBalance) {
      return res.status(400).json({
        message: `Overpayment not allowed. Remaining balance is ${remainingBalance}`,
      });
    }

    const newAmountPaid = booking.amountPaid + amt;

    let paymentStatus = "UNPAID";
    if (newAmountPaid === booking.totalAmount) paymentStatus = "PAID";
    else if (newAmountPaid > 0) paymentStatus = "PARTIALLY_PAID";

    await prisma.payment.create({
      data: {
        bookingId,
        amount: amt,
        ...(method ? { method } : {}),
      },
    });

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus,
      },
    });

    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: "Payment Received",
        message: `Payment of ${amt} recorded for booking #${bookingId}.`,
        type: "PAYMENT",
      },
    });

    return res.json({ message: "Payment recorded successfully", booking: updated });
  } catch (error) {
    console.error("RECORD PAYMENT ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   GET AVAILABILITY (simple)
========================= */
const getAvailability = async (req, res) => {
  try {
    const dateStr = req.query.date; // e.g. 2026-03-10
    if (!dateStr) return res.status(400).json({ message: "date query is required (YYYY-MM-DD)" });

    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // business hours 8-18 (local-ish); for simplicity keep in UTC
    const businessStartHour = 8;
    const businessEndHour = 18;

    const bookings = await prisma.booking.findMany({
      where: {
        status: { not: "CANCELLED" },
        appointmentStart: { lt: dayEnd },
        appointmentEnd: { gt: dayStart },
      },
      select: { appointmentStart: true, appointmentEnd: true },
    });

    const slots = [];

    for (let hour = businessStartHour; hour < businessEndHour; hour++) {
      const slotStart = new Date(dayStart);
      slotStart.setUTCHours(hour, 0, 0, 0);

      const slotEnd = new Date(dayStart);
      slotEnd.setUTCHours(hour + 1, 0, 0, 0);

      const overlapping = bookings.some(
        (b) => b.appointmentStart < slotEnd && b.appointmentEnd > slotStart
      );

      if (!overlapping) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }
    }

    return res.json({ availableSlots: slots });
  } catch (error) {
    console.error("GET AVAILABILITY ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   ASSIGN STAFF (Admin)
========================= */
/* =========================
   ASSIGN STAFF (Admin)
========================= */
const assignStaff = async (req, res) => {
  try {
    const bookingId = parseBookingId(req);
    const assignedStaffId = req.body.assignedStaffId || req.body.staffId;

    if (!bookingId) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    if (!assignedStaffId) {
      return res.status(400).json({ message: "assignedStaffId is required" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const staff = await prisma.user.findUnique({
      where: { id: assignedStaffId },
      select: { id: true, role: true }
    });

    if (!staff || staff.role !== "STAFF") {
      return res.status(400).json({ message: "Invalid staff user" });
    }

    /* =========================
       CHECK STAFF AVAILABILITY
    ========================= */

    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        assignedStaffId: assignedStaffId,
        status: { not: "CANCELLED" },
        appointmentStart: { lt: booking.appointmentEnd },
        appointmentEnd: { gt: booking.appointmentStart }
      }
    });

    if (conflictingBooking) {
      return res.status(400).json({
        message: "Staff already assigned to another booking during this time"
      });
    }

    /* =========================
       ASSIGN STAFF
    ========================= */

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        assignedStaffId,
        status: booking.status === "PENDING" ? "SCHEDULED" : booking.status
      }
    });

    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: "Staff Assigned",
        message: `A staff member has been assigned to booking #${bookingId}.`,
        type: "BOOKING"
      }
    });

    res.json({
      message: "Staff assigned successfully",
      booking: updated
    });

  } catch (error) {
    console.error("ASSIGN STAFF ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const bookingId = parseBookingId(req);
    const userId = req.user.id;
    const role = req.user.role;

    if (!bookingId) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // CUSTOMER can cancel their own booking
    if (role === "CUSTOMER") {
      if (booking.customerId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!["PENDING", "SCHEDULED"].includes(booking.status)) {
        return res.status(400).json({
          message: "Booking cannot be cancelled at this stage"
        });
      }
    }

    // STAFF cannot cancel
    if (role === "STAFF") {
      return res.status(403).json({
        message: "Staff cannot cancel bookings"
      });
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" }
    });

    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: "Booking Cancelled",
        message: `Booking #${bookingId} has been cancelled`,
        type: "BOOKING"
      }
    });

    res.json({
      message: "Booking cancelled successfully",
      booking: updated
    });

  } catch (error) {
    console.error("CANCEL BOOKING ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getBookingById = async (req, res) => {
  try {

    const bookingId = parseBookingId(req);

    if (!bookingId) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        assignedStaff: true,
        items: { include: { service: true } },
        payments: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(booking);

  } catch (error) {
    console.error("GET BOOKING ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* Admin analytics */
const getAdminAnalytics = async (req, res) => {
  try {

    const totalBookings = await prisma.booking.count();

    const completedBookings = await prisma.booking.count({
      where: { status: "COMPLETED" }
    });

    const pendingBookings = await prisma.booking.count({
      where: { status: "PENDING" }
    });

    const revenue = await prisma.booking.aggregate({
      _sum: { amountPaid: true }
    });

    res.json({
      totalBookings,
      completedBookings,
      pendingBookings,
      totalRevenue: revenue._sum.amountPaid || 0
    });

  } catch (error) {
    console.error("ANALYTICS ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* Staff schedule */
const getStaffSchedule = async (req, res) => {
  try {

    const staffId = req.user.id;

    const bookings = await prisma.booking.findMany({
      where: {
        assignedStaffId: staffId,
        status: { in: ["SCHEDULED", "ONGOING"] }
      },
      include: {
        customer: true,
        items: { include: { service: true } }
      },
      orderBy: {
        appointmentStart: "asc"
      }
    });

    res.json(bookings);

  } catch (error) {
    console.error("STAFF SCHEDULE ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


module.exports = {
  createBooking,
  getBookings,
  updateBookingStatus,
  recordPayment,
  getAvailability,
  assignStaff,
  cancelBooking,
  getBookingById,
  getAdminAnalytics,
  getStaffSchedule
};
const prisma = require("../config/prisma");

async function sendBookingReminders() {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60000);

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);

    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    const sameDayBookings = await prisma.booking.findMany({
      where: {
        appointmentStart: {
          gte: todayStart,
          lte: todayEnd
        },
        status: {
          in: ["CONFIRMED", "ONGOING"]
        }
      },
      include: {
        customer: true
      }
    });

    for (const booking of sameDayBookings) {
      await prisma.notification.create({
        data: {
          userId: booking.customerId,
          title: "Appointment Today",
          message: `Reminder: You have an appointment today at ${new Date(booking.appointmentStart).toLocaleTimeString()}.`,
          type: "BOOKING_REMINDER"
        }
      });
    }

    const oneHourBookings = await prisma.booking.findMany({
      where: {
        appointmentStart: {
          gte: now,
          lte: oneHourLater
        },
        status: {
          in: ["CONFIRMED"]
        }
      },
      include: {
        customer: true
      }
    });

    for (const booking of oneHourBookings) {
      await prisma.notification.create({
        data: {
          userId: booking.customerId,
          title: "Appointment in 1 Hour",
          message: `Your appointment starts at ${new Date(booking.appointmentStart).toLocaleTimeString()}.`,
          type: "BOOKING_REMINDER"
        }
      });
    }
  } catch (error) {
    console.error("Booking reminders error:", error);
  }
}

module.exports = sendBookingReminders;
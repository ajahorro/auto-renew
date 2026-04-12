const prisma = require("../config/prisma");

async function sendBookingReminders() {

  const now = new Date();

  const oneHourLater = new Date(now.getTime() + 60 * 60000);

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  const todayEnd = new Date();
  todayEnd.setHours(23,59,59,999);

  /*
  SAME DAY REMINDERS
  */

  const sameDayBookings = await prisma.booking.findMany({

    where: {

      appointmentStart: {
        gte: todayStart,
        lte: todayEnd
      },

      sameDayReminderSent: false,

      status: {
        in: ["SCHEDULED"]
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

        message: `Reminder: You have an appointment today at ${booking.appointmentStart.toLocaleTimeString()}.`,

        type: "BOOKING_REMINDER"

      }

    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { sameDayReminderSent: true }
    });

  }

  /*
  ONE HOUR REMINDERS
  */

  const oneHourBookings = await prisma.booking.findMany({

    where: {

      appointmentStart: {
        gte: now,
        lte: oneHourLater
      },

      oneHourReminderSent: false,

      status: {
        in: ["SCHEDULED"]
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

        message: `Your appointment starts at ${booking.appointmentStart.toLocaleTimeString()}.`,

        type: "BOOKING_REMINDER"

      }

    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { oneHourReminderSent: true }
    });

  }

}

module.exports = sendBookingReminders;
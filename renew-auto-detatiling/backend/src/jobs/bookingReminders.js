const prisma = require("../config/prisma");

/**
 * Sends booking reminder notifications.
 *
 * Uses the `sameDayReminderSent` and `oneHourReminderSent` flags on
 * each booking so that reminders are sent exactly once, even though
 * the cron runs every hour.
 */
async function sendBookingReminders() {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60000);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // ── Same-day reminders (sent once per booking) ──────────────────
    const sameDayBookings = await prisma.booking.findMany({
      where: {
        appointmentStart: {
          gte: todayStart,
          lte: todayEnd
        },
        status: {
          in: ["CONFIRMED", "ONGOING"]
        },
        sameDayReminderSent: false
      },
      include: {
        customer: true
      }
    });

    for (const booking of sameDayBookings) {
      await prisma.$transaction(async (tx) => {
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            title: "Appointment Today",
            message: `Reminder: You have an appointment today at ${new Date(booking.appointmentStart).toLocaleTimeString()}.`,
            type: "BOOKING_REMINDER"
          }
        });

        await tx.booking.update({
          where: { id: booking.id },
          data: { sameDayReminderSent: true }
        });
      });
    }

    // ── One-hour reminders (sent once per booking) ───────────────────
    const oneHourBookings = await prisma.booking.findMany({
      where: {
        appointmentStart: {
          gte: now,
          lte: oneHourLater
        },
        status: {
          in: ["CONFIRMED"]
        },
        oneHourReminderSent: false
      },
      include: {
        customer: true
      }
    });

    for (const booking of oneHourBookings) {
      await prisma.$transaction(async (tx) => {
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            title: "Appointment in 1 Hour",
            message: `Your appointment starts at ${new Date(booking.appointmentStart).toLocaleTimeString()}.`,
            type: "BOOKING_REMINDER"
          }
        });

        await tx.booking.update({
          where: { id: booking.id },
          data: { oneHourReminderSent: true }
        });
      });
    }

    if (sameDayBookings.length + oneHourBookings.length > 0) {
      console.log(
        `[REMINDERS] Sent ${sameDayBookings.length} same-day, ${oneHourBookings.length} one-hour reminders`
      );
    }
  } catch (error) {
    console.error("Booking reminders error:", error);
  }
}

module.exports = sendBookingReminders;
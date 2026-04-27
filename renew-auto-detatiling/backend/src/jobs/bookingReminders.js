const { sendLateStartReminders } = require("../services/automation.service");

async function sendBookingReminders() {
  const reminders = await sendLateStartReminders();
  return { reminders };
}

module.exports = sendBookingReminders;

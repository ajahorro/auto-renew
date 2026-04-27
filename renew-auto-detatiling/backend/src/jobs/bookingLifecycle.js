const { syncDerivedBookingStatuses, autoCancelUnpaidScheduledBookings, ensureRefundsForCancelledBookings } = require("../services/automation.service");

async function syncBookingLifecycleStates() {
  const [synced, autoCancelled, refundsCreated] = await Promise.all([
    syncDerivedBookingStatuses(),
    autoCancelUnpaidScheduledBookings(),
    ensureRefundsForCancelledBookings()
  ]);

  return {
    synced,
    autoCancelled,
    refundsCreated
  };
}

module.exports = syncBookingLifecycleStates;

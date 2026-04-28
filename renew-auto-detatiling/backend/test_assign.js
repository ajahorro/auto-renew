
Invalid `prisma.notificationQue

async function test() {
  const bookingId = 1;
  const staffId = "cmoi0p71c0000nq7n5jqbj56n"; // From my previous check
  const adminId = "cmoi0p71c0000nq7n5jqbj56n"; // Same admin
  
  try {
    console.log('Testing assignment for booking 1...');
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new Error('Booking not found');
      
      const staff = await tx.user.findUnique({ where: { id: staffId } });
      if (!staff) throw new Error('Staff not found');

      // 2. Update
      await tx.booking.update({
        where: { id: bookingId },
        data: { assignedStaffId: staffId }
      });

      // 3. Notify
      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Test",
          message: "Test",
          type: "BOOKING"
        }
      });

      // 4. Audit
      const auditService = require('./src/services/audit.service');
      await auditService.logAction(tx, {
        userId: adminId,
        action: "STAFF_ASSIGNED",
        entityType: "Booking",
        entityId: String(bookingId),
        details: "Manual test assignment",
        bookingId: bookingId
      });
      
      return { success: true };
    });
    console.log('Result:', result);
  } catch (e) {
    console.error('TRANSACTION FAILED:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();

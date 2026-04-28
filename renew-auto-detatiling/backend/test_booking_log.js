const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const booking = await prisma.booking.findFirst();
    if (!booking) return console.log('No bookings found');
    
    console.log('Using Booking:', booking.id);
    const log = await prisma.auditLog.create({
      data: {
        bookingId: booking.id,
        action: "TEST_BOOKING_LOG",
        entityType: "Booking",
        entityId: String(booking.id),
        details: "Testing log with real booking relation"
      }
    });
    console.log('Log created with booking relation:', log.id);
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();

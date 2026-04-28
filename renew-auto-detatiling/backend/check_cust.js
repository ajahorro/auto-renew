const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const b = await prisma.booking.findUnique({ where: { id: 1 } });
    if (!b) return console.log('No booking 1');
    const u = await prisma.user.findUnique({ where: { id: b.customerId } });
    console.log('Booking 1 Customer ID:', b.customerId);
    console.log('Customer User Record:', u ? u.fullName : 'NOT FOUND');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();

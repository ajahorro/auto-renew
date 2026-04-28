const prisma = require("./src/config/prisma")

async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return console.log('No users found');
    
    console.log('Using User:', user.id);
    const log = await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "STAFF_ASSIGNED",
        entityType: "Booking",
        entityId: "1",
        details: "Manual test assignment log",
        oldValue: { assignedStaff: "None" },
        newValue: { assignedStaff: "Test Staff" }
      }
    });
    console.log('Log created:', log.id);
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();

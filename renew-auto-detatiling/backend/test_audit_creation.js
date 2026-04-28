const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Attempting to create audit log...');
    const log = await prisma.auditLog.create({
      data: {
        userId: null,
        action: "TEST_ACTION",
        entityType: "TEST",
        entityId: "123",
        details: "Testing audit log creation",
        oldValue: { test: 1 },
        newValue: { test: 2 }
      }
    });
    console.log('Success:', log);
  } catch (e) {
    console.error('FAILED TO CREATE LOG:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();

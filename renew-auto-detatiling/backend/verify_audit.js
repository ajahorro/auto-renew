const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const log = await prisma.auditLog.create({
      data: {
        action: "RENEW_SYSTEM_RECOVERY",
        entityType: "SYSTEM",
        entityId: "GLOBAL",
        details: "Audit log system verified by Antigravity AI"
      }
    });
    console.log('Success! Log created:', log.id);
  } catch (e) {
    console.error('FAILED:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const count = await prisma.auditLog.count();
    console.log('AuditLog count:', count);
    const latest = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        performer: { select: { fullName: true } },
        booking: { select: { id: true } }
      }
    });
    console.log('Latest log:', JSON.stringify(latest, null, 2));
  } catch (e) {
    console.error('AuditLog DB Check Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

check();

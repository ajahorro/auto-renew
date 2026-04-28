const prisma = require("../config/prisma")

async function main() {
  const bookingId = 2; // Testing with booking 2
  console.log(`Checking logs for bookingId: ${bookingId}`);
  
  const logs = await prisma.auditLog.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log('LOGS FOUND:', logs.length);
  console.log(JSON.stringify(logs, null, 2));

  const allLogs = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log('LATEST GLOBAL LOGS:');
  console.log(JSON.stringify(allLogs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.user.findMany({ where: { role: 'STAFF' } });
    console.log(JSON.stringify(users.map(u => ({ id: u.id, name: u.fullName })), null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();

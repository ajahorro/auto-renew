const prisma = require("./src/config/prisma");

async function check() {
  try {
    const result = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'AuditLog'`;
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('AuditLog Column Check Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

check();

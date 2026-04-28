const prisma = require("./src/config/prisma");

async function check() {
  try {
    const r = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Payment'`;
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();

const prisma = require("./src/config/prisma");

async function check() {
  try {
    const r = await prisma.user.findMany({ select: { id: true, fullName: true, role: true, isActive: true } });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();

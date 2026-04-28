const prisma = require("./src/config/prisma");

async function check() {
  try {
    const r = await prisma.booking.findUnique({ where: { id: 1 } });
    console.log(JSON.stringify(r, null, 2));
  } finally {
    // IMPORTANT: don't always disconnect in dev shared pool setups
    await prisma.$disconnect();
  }
}

check();
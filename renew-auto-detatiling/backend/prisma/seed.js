const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@renew.com" },
    update: {},
    create: {
      email: "admin@renew.com",
      password,
      fullName: "System Admin",
      role: "SUPER_ADMIN"
    }
  });

  await prisma.service.createMany({
    data: [
      { name: "Exterior Wash", price: 300, durationMin: 30 },
      { name: "Interior Cleaning", price: 500, durationMin: 45 },
      { name: "Full Detailing", price: 1500, durationMin: 120 }
    ],
    skipDuplicates: true
  });

  console.log("Seed completed");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const bcrypt = require('bcrypt');

const prisma = require("../src/config/prisma")

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@renew' },
    update: {},
    create: {
      email: 'admin@renew',
      password: hashedPassword,
      fullName: 'Admin',
      role: 'ADMIN'
    },
  });

  console.log("Admin created successfully: admin@renew / admin123");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
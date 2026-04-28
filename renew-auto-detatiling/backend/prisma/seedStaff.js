const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma")


async function main() {

  const password = await bcrypt.hash("staff123", 10);

  await prisma.user.createMany({
    data: [
      {
        email: "staff1@renew.com",
        password: password,
        fullName: "Juan Dela Cruz",
        role: "STAFF"
      },
      {
        email: "staff2@renew.com",
        password: password,
        fullName: "Maria Santos",
        role: "STAFF"
      }
    ],
    skipDuplicates: true
  });

  console.log("Staff accounts created.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
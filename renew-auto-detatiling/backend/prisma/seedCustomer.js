const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {

  const password = await bcrypt.hash("customer123", 10);

  await prisma.user.create({
    data: {
      email: "customer@renew.com",
      password: password,
      fullName: "Test Customer",
      role: "CUSTOMER"
    }
  });

  console.log("Customer account created.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
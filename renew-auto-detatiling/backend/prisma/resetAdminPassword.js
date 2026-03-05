const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // change these 2 if needed
  const adminEmail = "admin@test.com";
  const newPasswordPlain = "Admin12345!";

  const newHash = await bcrypt.hash(newPasswordPlain, 10);

  const updated = await prisma.user.update({
    where: { email: adminEmail },
    data: { password: newHash },
    select: { id: true, email: true, role: true },
  });

  console.log("✅ Updated:", updated);
  console.log("✅ New admin password is:", newPasswordPlain);
}

main()
  .catch((e) => {
    console.error("❌", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
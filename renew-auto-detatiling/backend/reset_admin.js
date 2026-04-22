const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function resetAdmin() {
  const email = "admin@renew";
  const password = "admin123";
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        role: "ADMIN",
        isActive: true,
        emailVerified: true
      },
      create: {
        email,
        password: hashedPassword,
        fullName: "Admin User",
        role: "ADMIN",
        isActive: true,
        emailVerified: true
      }
    });
    console.log(`✅ Admin account ${email} reset successfully! Password is: ${password}`);
  } catch (error) {
    console.error("❌ Failed to reset admin account:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdmin();

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function testDB() {
  try {
    console.log("Testing database connection...");
    const result = await prisma.user.findUnique({ 
      where: { email: "admin@renew.com" } 
    });
    console.log("DB Query Result:", result ? "User found" : "No user");
    console.log("User:", result);
  } catch (error) {
    console.error("DB Error:", error.message);
    console.error("Error Code:", error.code);
  } finally {
    await prisma.$disconnect();
  }
}

testDB();

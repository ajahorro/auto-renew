const prisma = require("./src/config/prisma");

async function main() {
  const settings = await prisma.businessSettings.findFirst();
  console.log("Business Settings:", JSON.stringify(settings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

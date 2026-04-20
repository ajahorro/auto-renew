const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {

  console.log("Seeding users...");

  console.log("DATABASE_URL:", process.env.DATABASE_URL);

  const users = [
    // Admin
    { email: "admin@renew", password: "admin123", fullName: "Admin User", role: "ADMIN" },
    // Staff
    { email: "staff1@renew", password: "staff123", fullName: "Juan Dela Cruz", role: "STAFF" },
    { email: "staff2@renew", password: "staff123", fullName: "Maria Santos", role: "STAFF" },
    { email: "staff3@renew", password: "staff123", fullName: "Pedro Garcia", role: "STAFF" },
    // Customers
    { email: "customer1@renew", password: "customer123", fullName: "John Smith", role: "CUSTOMER" },
    { email: "customer2@renew", password: "customer123", fullName: "Jane Doe", role: "CUSTOMER" },
  ];

  for (const userData of users) {
    const existing = await prisma.user.findUnique({ where: { email: userData.email } });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          fullName: userData.fullName,
          role: userData.role,
          isActive: true,
          emailVerified: true
        }
      });
      console.log(`Created: ${userData.role} - ${userData.email} / ${userData.password}`);
    } else {
      console.log(`Exists: ${userData.role} - ${userData.email}`);
    }
  }

  console.log("Seeding services...");

  const serviceSeedData = [

      // EXTERIOR SERVICES

      {
        name: "Exterior Wash",
        description: "Complete exterior hand wash removing dirt, road grime, and contaminants while restoring your vehicle's shine.",
        category: "EXTERIOR",
        price: 500,
        durationMin: 45
      },

      {
        name: "Wax Protection",
        description: "Protective wax coating applied to enhance gloss and shield paint from UV rays and contaminants.",
        category: "EXTERIOR",
        price: 700,
        durationMin: 30
      },

      {
        name: "Tire and Rim Cleaning",
        description: "Deep cleaning of tires and rims removing brake dust, grease, and accumulated road debris.",
        category: "EXTERIOR",
        price: 300,
        durationMin: 20
      },


      // INTERIOR SERVICES

      {
        name: "Interior Vacuum",
        description: "Full interior vacuum cleaning including carpets, seats, floor mats, and trunk area.",
        category: "INTERIOR",
        price: 400,
        durationMin: 30
      },

      {
        name: "Dashboard Cleaning",
        description: "Cleaning and conditioning of dashboard and interior panels to remove dust and restore finish.",
        category: "INTERIOR",
        price: 300,
        durationMin: 20
      },

      {
        name: "Seat Shampoo",
        description: "Deep cleaning treatment removing stains, odors, and dirt from fabric or leather seats.",
        category: "INTERIOR",
        price: 800,
        durationMin: 45
      },


      // SPECIALIZED SERVICES

      {
        name: "Engine Bay Cleaning",
        description: "Safe degreasing and detailing of the engine bay to remove oil residue and dirt buildup.",
        category: "SPECIALIZED",
        price: 900,
        durationMin: 40
      },

      {
        name: "Headlight Restoration",
        description: "Removes oxidation and yellowing from headlights restoring clarity and brightness.",
        category: "SPECIALIZED",
        price: 600,
        durationMin: 30
      },

      {
        name: "Full Detailing Package",
        description: "Complete interior and exterior detailing service restoring your vehicle inside and out.",
        category: "SPECIALIZED",
        price: 2000,
        durationMin: 120
      }

  ];

  for (const service of serviceSeedData) {
    const existing = await prisma.service.findFirst({
      where: {
        name: service.name,
        category: service.category,
        price: service.price,
        durationMin: service.durationMin,
        isActive: true
      }
    });

    if (!existing) {
      await prisma.service.create({ data: service });
    }
  }

  console.log("Services seeded successfully.");

}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

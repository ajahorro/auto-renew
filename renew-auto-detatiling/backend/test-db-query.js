const prisma = require("./src/config/prisma");

async function test() {
  try {
    await prisma.$connect();
    console.log("Connected to database");

    const booking3 = await prisma.booking.findUnique({
      where: { id: 3 },
      include: {
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        assignedStaff: { select: { id: true, fullName: true } },
        items: { include: { service: true } },
        payments: true
      }
    });
    console.log("Booking 3:", JSON.stringify(booking3, null, 2));

    const payments = await prisma.payment.findMany({
      where: { status: "VERIFIED" },
      include: {
        booking: {
          include: {
            customer: { select: { id: true, fullName: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    console.log("Payments with VERIFIED status:", payments.length);

  } catch (err) {
    console.error("Error:", err.message);
    console.error("Details:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();

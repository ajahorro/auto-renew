const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Creating sample bookings...");

  // Get customers and staff
  const customer1 = await prisma.user.findUnique({ where: { email: "customer1@renew" } });
  const customer2 = await prisma.user.findUnique({ where: { email: "customer2@renew" } });
  const staff1 = await prisma.user.findUnique({ where: { email: "staff1@renew" } });
  const staff2 = await prisma.user.findUnique({ where: { email: "staff2@renew" } });

  if (!customer1 || !customer2 || !staff1 || !staff2) {
    console.error("Users not found. Run seed.js first.");
    process.exit(1);
  }

  // Get services
  const services = await prisma.service.findMany({ take: 3 });

  // Appointment date - tomorrow at 10 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const appointmentEnd = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000); // 2 hours

  // Check for existing bookings to avoid duplicates
  const existingBookings = await prisma.booking.findFirst({
    where: {
      customerId: { in: [customer1.id, customer2.id] },
      appointmentDate: tomorrow
    }
  });

  if (existingBookings) {
    console.log("Sample bookings already exist.");
    process.exit(0);
  }

  // Create booking for customer 1
  const booking1 = await prisma.booking.create({
    data: {
      customerId: customer1.id,
      status: "confirmed",
      totalAmount: 1500,
      amountPaid: 1500,
      paymentStatus: "completed",
      paymentMethod: "GCASH",
      vehicleType: "Sedan",
      plateNumber: "ABC 1234",
      contactNumber: "09171234567",
      notes: "Please wash the exterior thoroughly",
      appointmentDate: tomorrow,
      appointmentStart: tomorrow,
      appointmentEnd: appointmentEnd,
      assignedStaffId: staff1.id,
      isDownpaymentRequired: false,
      downpaymentAmount: 0,
      isLocked: false
    }
  });

  // Create booking items for customer 1
  await prisma.bookingItem.createMany({
    data: [
      {
        bookingId: booking1.id,
        serviceId: services[0].id,
        serviceNameAtBooking: services[0].name,
        priceAtBooking: services[0].price,
        durationAtBooking: services[0].durationMin,
        scheduledDateTime: tomorrow
      },
      {
        bookingId: booking1.id,
        serviceId: services[1].id,
        serviceNameAtBooking: services[1].name,
        priceAtBooking: services[1].price,
        durationAtBooking: services[1].durationMin,
        scheduledDateTime: new Date(tomorrow.getTime() + services[0].durationMin * 60000)
      }
    ]
  });

  console.log(`Created booking #${booking1.id} for ${customer1.fullName} - Staff: ${staff1.fullName}`);

  // Create booking for customer 2 (same time slot)
  const booking2 = await prisma.booking.create({
    data: {
      customerId: customer2.id,
      status: "confirmed",
      totalAmount: 2000,
      amountPaid: 2000,
      paymentStatus: "completed",
      paymentMethod: "CASH",
      vehicleType: "SUV",
      plateNumber: "XYZ 5678",
      contactNumber: "09198765432",
      notes: "Interior vacuum and seat shampoo",
      appointmentDate: tomorrow,
      appointmentStart: tomorrow,
      appointmentEnd: appointmentEnd,
      assignedStaffId: staff2.id,
      isDownpaymentRequired: false,
      downpaymentAmount: 0,
      isLocked: false
    }
  });

  // Create booking items for customer 2
  await prisma.bookingItem.createMany({
    data: [
      {
        bookingId: booking2.id,
        serviceId: services[2].id,
        serviceNameAtBooking: services[2].name,
        priceAtBooking: services[2].price,
        durationAtBooking: services[2].durationMin,
        scheduledDateTime: tomorrow
      },
      {
        bookingId: booking2.id,
        serviceId: services[0].id,
        serviceNameAtBooking: services[0].name,
        priceAtBooking: services[0].price,
        durationAtBooking: services[0].durationMin,
        scheduledDateTime: new Date(tomorrow.getTime() + services[2].durationMin * 60000)
      }
    ]
  });

  console.log(`Created booking #${booking2.id} for ${customer2.fullName} - Staff: ${staff2.fullName}`);
  console.log(`\nBoth bookings scheduled for: ${tomorrow.toLocaleString()}`);

  // Create notifications for staff
  await prisma.notification.createMany({
    data: [
      {
        userId: staff1.id,
        title: "New Booking Assigned",
        message: `You have been assigned to booking #${booking1.id} for ${customer1.fullName}.`,
        type: "BOOKING",
        actionType: "STAFF_ASSIGNED",
        targetId: String(booking1.id)
      },
      {
        userId: staff2.id,
        title: "New Booking Assigned",
        message: `You have been assigned to booking #${booking2.id} for ${customer2.fullName}.`,
        type: "BOOKING",
        actionType: "STAFF_ASSIGNED",
        targetId: String(booking2.id)
      },
      {
        userId: customer1.id,
        title: "Booking Confirmed",
        message: `Your appointment on ${tomorrow.toLocaleString()} has been confirmed. ${staff1.fullName} will service your vehicle.`,
        type: "BOOKING",
        actionType: "CONFIRMED",
        targetId: String(booking1.id)
      },
      {
        userId: customer2.id,
        title: "Booking Confirmed",
        message: `Your appointment on ${tomorrow.toLocaleString()} has been confirmed. ${staff2.fullName} will service your vehicle.`,
        type: "BOOKING",
        actionType: "CONFIRMED",
        targetId: String(booking2.id)
      }
    ]
  });

  console.log("\nNotifications created for staff and customers.");
  console.log("\n✅ Sample data setup complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

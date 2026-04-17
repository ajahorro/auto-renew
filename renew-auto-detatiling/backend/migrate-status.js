const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration...");

  // First, add new enum values to the PostgreSQL enums
  console.log("Adding new enum values...");

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'ONGOING'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'COMPLETED'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CANCELLED'`);
    console.log("Added new BookingStatus values");
  } catch (e) {
    console.log("BookingStatus values may already exist:", e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "CancellationStatus" ADD VALUE IF NOT EXISTS 'NONE'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "CancellationStatus" ADD VALUE IF NOT EXISTS 'REQUESTED'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "CancellationStatus" ADD VALUE IF NOT EXISTS 'APPROVED'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "CancellationStatus" ADD VALUE IF NOT EXISTS 'REJECTED'`);
    console.log("Added new CancellationStatus values");
  } catch (e) {
    console.log("CancellationStatus values may already exist:", e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'NONE'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'PENDING'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'PROCESSED'`);
    console.log("Added new RefundStatus values");
  } catch (e) {
    console.log("RefundStatus values may already exist:", e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PENDING'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'APPROVED'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED'`);
    console.log("Added new PaymentStatus values");
  } catch (e) {
    console.log("PaymentStatus values may already exist:", e.message);
  }

  // Now update the data using template literals (direct SQL)
  console.log("Updating booking statuses...");

  const statusUpdates = [
    ['draft', 'PENDING'],
    ['pending', 'PENDING'],
    ['pending_payment', 'PENDING'],
    ['partially_paid', 'PENDING'],
    ['confirmed', 'CONFIRMED'],
    ['scheduled', 'CONFIRMED'],
    ['ongoing', 'ONGOING'],
    ['completed', 'COMPLETED'],
    ['cancelled', 'CANCELLED'],
    ['cancel_requested', 'PENDING']
  ];

  for (const [oldStatus, newStatus] of statusUpdates) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Booking" SET status = '${newStatus}'::"BookingStatus" WHERE status::text = '${oldStatus}'`
    );
    if (result > 0) {
      console.log(`Updated ${result} bookings from '${oldStatus}' to '${newStatus}'`);
    }
  }

  console.log("Updating cancellation statuses...");
  const cancelStatusUpdates = [
    ['none', 'NONE'],
    ['requested', 'REQUESTED'],
    ['approved', 'APPROVED'],
    ['rejected', 'REJECTED']
  ];

  for (const [oldStatus, newStatus] of cancelStatusUpdates) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Booking" SET "cancellationStatus" = '${newStatus}'::"CancellationStatus" WHERE "cancellationStatus"::text = '${oldStatus}'`
    );
    if (result > 0) {
      console.log(`Updated ${result} bookings from cancellationStatus '${oldStatus}' to '${newStatus}'`);
    }
  }

  console.log("Updating refund statuses...");
  const refundStatusUpdates = [
    ['none', 'NONE'],
    ['pending', 'PENDING'],
    ['processed', 'PROCESSED']
  ];

  for (const [oldStatus, newStatus] of refundStatusUpdates) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Booking" SET "refundStatus" = '${newStatus}'::"RefundStatus" WHERE "refundStatus"::text = '${oldStatus}'`
    );
    if (result > 0) {
      console.log(`Updated ${result} bookings from refundStatus '${oldStatus}' to '${newStatus}'`);
    }
  }

  console.log("Updating payment statuses...");
  const paymentStatusUpdates = [
    ['pending', 'PENDING'],
    ['approved', 'APPROVED'],
    ['rejected', 'REJECTED'],
    ['verified', 'APPROVED'],
    ['completed', 'APPROVED']
  ];

  for (const [oldStatus, newStatus] of paymentStatusUpdates) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Payment" SET status = '${newStatus}'::"PaymentStatus" WHERE status::text = '${oldStatus}'`
    );
    if (result > 0) {
      console.log(`Updated ${result} payments from '${oldStatus}' to '${newStatus}'`);
    }
  }

  console.log("Updating cancellation request statuses...");
  const cancelReqStatusUpdates = [
    ['none', 'NONE'],
    ['requested', 'REQUESTED'],
    ['approved', 'APPROVED'],
    ['rejected', 'REJECTED']
  ];

  for (const [oldStatus, newStatus] of cancelReqStatusUpdates) {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "CancellationRequest" SET status = '${newStatus}'::"CancellationStatus" WHERE status::text = '${oldStatus}'`
    );
    if (result > 0) {
      console.log(`Updated ${result} cancellation requests from '${oldStatus}' to '${newStatus}'`);
    }
  }

  console.log("Migration complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

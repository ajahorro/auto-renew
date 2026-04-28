const prisma = require("./src/config/prisma");

async function check() {
  try {
    await p.$connect();
    
    // Check business_settings columns
    const result = await p.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'BusinessSettings'`;
    console.log('BusinessSettings columns:', result);
    
    // Check Booking columns
    const bookingCols = await p.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'Booking'`;
    console.log('\nBooking columns:', bookingCols);
    
    await p.$disconnect();
  } catch (e) {
    console.log('Error:', e.message);
    await p.$disconnect();
  }
}

check();

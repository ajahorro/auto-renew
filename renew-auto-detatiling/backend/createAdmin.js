const prisma = require('./src/config/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'admin@renew.com';
  const password = 'Admin123!';
  const fullName = 'Admin';

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    console.log('Admin account already exists!');
    console.log('Email:', email);
    console.log('Password: (unchanged from creation)');
    console.log('\nTo change the password, run this script after updating the password below.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      fullName,
      role: 'ADMIN'
    }
  });

  console.log('====================================');
  console.log('  ADMIN ACCOUNT CREATED SUCCESSFULLY');
  console.log('====================================');
  console.log('Email:    ', email);
  console.log('Password: ', password);
  console.log('====================================');
  console.log('\nYou can now login with these credentials.');
  console.log('URL: http://localhost:5173/login');
}

main()
  .catch(e => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());

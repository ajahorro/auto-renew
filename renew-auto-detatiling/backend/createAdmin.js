const prisma = require('./src/config/prisma');
const bcrypt = require('bcrypt');

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: hashedPassword,
      fullName: 'Admin User',
      role: 'ADMIN'
    }
  });

  console.log('Admin created:', admin);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
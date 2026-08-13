import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_meal_db?schema=public';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding initial data...');

  const adminEmail = 'admin@smartmeal.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await argon2.hash('AdminPassword123!');
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'System',
        lastName: 'SuperAdmin',
        role: Role.SUPER_ADMIN,
        isEmailVerified: true,
      },
    });
    console.log(`Created default Super Admin user: ${admin.email}`);
  } else {
    console.log('Super Admin user already exists.');
  }

  await prisma.$disconnect();
  await pool.end();
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  });

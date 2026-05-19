/**
 * Creates a standalone ADMIN user in the database.
 * Run once: npx ts-node scripts/create-admin.ts
 * Does NOT clear any existing data.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Find the first branch to attach the admin to
  const branch = await prisma.branch.findFirst();
  if (!branch) {
    console.error('No branch found. Run the seed first (npm run db:seed).');
    process.exit(1);
  }

  const email = 'admin@roselllastores.com';
  const password = 'MekaAdmin@2025';

  // Check if admin already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email,
      password: hashed,
      role: 'ADMIN',
      branchId: branch.id,
    },
  });

  console.log('');
  console.log('✅ Admin user created successfully!');
  console.log('');
  console.log('  Email:    ' + email);
  console.log('  Password: ' + password);
  console.log('  Role:     ADMIN');
  console.log('  Branch:   ' + branch.name);
  console.log('');
  console.log('Change the password after first login via Settings → Change Password.');
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  const existingBranch = await prisma.branch.findFirst();
  const branch =
    existingBranch ??
    (await prisma.branch.create({
      data: {
        name: 'Rosella Stores',
        address: 'Your business address here',
        phone: '+234-000-000-0000',
        isActive: true,
      },
    }));

  console.log('Branch created:', branch.id);

  const hashedOwnerPassword = await bcrypt.hash('owner123', 10);
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  const hashedCashierPassword = await bcrypt.hash('cashier123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@rosellastores.com' },
    update: {
      name: 'Owner',
      password: hashedOwnerPassword,
      role: 'OWNER',
      branchId: branch.id,
    },
    create: {
      name: 'Owner',
      email: 'admin@rosellastores.com',
      password: hashedOwnerPassword,
      role: 'OWNER',
      branchId: branch.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'superadmin@rosellastores.com' },
    update: {
      name: 'Admin',
      password: hashedAdminPassword,
      role: 'ADMIN',
      branchId: branch.id,
    },
    create: {
      name: 'Admin',
      email: 'superadmin@rosellastores.com',
      password: hashedAdminPassword,
      role: 'ADMIN',
      branchId: branch.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'cashier@rosellastores.com' },
    update: {
      name: 'Cashier',
      password: hashedCashierPassword,
      role: 'CASHIER',
      branchId: branch.id,
    },
    create: {
      name: 'Cashier',
      email: 'cashier@rosellastores.com',
      password: hashedCashierPassword,
      role: 'CASHIER',
      branchId: branch.id,
    },
  });

  console.log('Users created (admin + owner + cashier)');

  // System Settings only - NO sample categories, products, suppliers, or customers
  const settings = [
    { key: 'businessName', value: 'Rosella Stores', description: 'Business name' },
    { key: 'taxRate', value: '7.5', description: 'Tax rate in percentage' },
    { key: 'eodTime', value: '21:00', description: 'End of day time (HH:mm)' },
    { key: 'ownerEmail', value: 'admin@rosellastores.com', description: 'Owner email for reports' },
    { key: 'currency', value: 'NGN', description: 'Currency code' },
    { key: 'lowStockAlert', value: 'true', description: 'Enable low stock alerts' },
    { key: 'businessAddress', value: 'Your business address here', description: 'Business address' },
    { key: 'businessPhone', value: '+234-000-000-0000', description: 'Business phone' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: setting,
    });
  }

  console.log('Settings created');
  console.log('');
  console.log('===========================================');
  console.log('  Database seeded!');
  console.log('  No template products or categories were created.');
  console.log('');
  console.log('  Login credentials:');
  console.log('  Admin:   superadmin@rosellastores.com / admin123');
  console.log('  Owner:   admin@rosellastores.com / owner123');
  console.log('  Cashier: cashier@rosellastores.com / cashier123');
  console.log('===========================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

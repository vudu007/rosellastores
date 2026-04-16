import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.discountCode.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.setting.deleteMany();

  // Create Branch
  const branch = await prisma.branch.create({
    data: {
      name: 'Main Store',
      address: '123 Commerce Street, Business District',
      phone: '+234-800-000-0000',
      isActive: true,
    },
  });

  console.log('Branch created:', branch.id);

  // Create Users
  const hashedOwnerPassword = await bcrypt.hash('owner123', 10);
  const hashedManagerPassword = await bcrypt.hash('manager123', 10);
  const hashedCashierPassword = await bcrypt.hash('cashier123', 10);

  const owner = await prisma.user.create({
    data: {
      name: 'Store Owner',
      email: 'owner@store.com',
      password: hashedOwnerPassword,
      role: 'OWNER',
      branchId: branch.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Store Manager',
      email: 'manager@store.com',
      password: hashedManagerPassword,
      role: 'MANAGER',
      branchId: branch.id,
    },
  });

  const cashier1 = await prisma.user.create({
    data: {
      name: 'Cashier One',
      email: 'cashier1@store.com',
      password: hashedCashierPassword,
      role: 'CASHIER',
      branchId: branch.id,
    },
  });

  const cashier2 = await prisma.user.create({
    data: {
      name: 'Cashier Two',
      email: 'cashier2@store.com',
      password: hashedCashierPassword,
      role: 'CASHIER',
      branchId: branch.id,
    },
  });

  console.log('Users created');

  // Create Categories
  const electronicsCategory = await prisma.category.create({
    data: { name: 'Electronics' },
  });

  const clothingCategory = await prisma.category.create({
    data: { name: 'Clothing' },
  });

  const foodCategory = await prisma.category.create({
    data: { name: 'Food & Beverages' },
  });

  const healthCategory = await prisma.category.create({
    data: { name: 'Health & Beauty' },
  });

  const stationeryCategory = await prisma.category.create({
    data: { name: 'Stationery' },
  });

  console.log('Categories created');

  // Create Suppliers
  const supplier1 = await prisma.supplier.create({
    data: {
      name: 'TechWholesale Inc',
      contact: 'John Supplier',
      email: 'contact@techwholesale.com',
      phone: '+234-701-111-1111',
      address: '456 Supplier Lane, Industrial Zone',
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      name: 'Fashion Imports Ltd',
      contact: 'Maria Fashion',
      email: 'orders@fashionimports.com',
      phone: '+234-702-222-2222',
      address: '789 Fashion Boulevard, Commerce City',
    },
  });

  const supplier3 = await prisma.supplier.create({
    data: {
      name: 'Global Foods Co',
      contact: 'Ahmed Foods',
      email: 'supply@globalfoods.com',
      phone: '+234-703-333-3333',
      address: '321 Food Street, Distribution Hub',
    },
  });

  console.log('Suppliers created');

  // Create Products
  const products = [
    // Electronics (5)
    {
      name: 'Wireless Headphones',
      sku: 'ELEC-001',
      barcode: '1234567890001',
      categoryId: electronicsCategory.id,
      retailPrice: 15999,
      wholesalePrice: 12000,
      stockQty: 45,
      supplierId: supplier1.id,
    },
    {
      name: 'USB-C Cable',
      sku: 'ELEC-002',
      barcode: '1234567890002',
      categoryId: electronicsCategory.id,
      retailPrice: 2999,
      wholesalePrice: 1800,
      stockQty: 150,
      supplierId: supplier1.id,
    },
    {
      name: 'Power Bank 20000mAh',
      sku: 'ELEC-003',
      barcode: '1234567890003',
      categoryId: electronicsCategory.id,
      retailPrice: 8999,
      wholesalePrice: 6500,
      stockQty: 32,
      supplierId: supplier1.id,
    },
    {
      name: 'Screen Protector',
      sku: 'ELEC-004',
      barcode: '1234567890004',
      categoryId: electronicsCategory.id,
      retailPrice: 1499,
      wholesalePrice: 900,
      stockQty: 200,
      supplierId: supplier1.id,
    },
    {
      name: 'Bluetooth Speaker',
      sku: 'ELEC-005',
      barcode: '1234567890005',
      categoryId: electronicsCategory.id,
      retailPrice: 12999,
      wholesalePrice: 9500,
      stockQty: 28,
      supplierId: supplier1.id,
    },
    // Clothing (4)
    {
      name: 'Cotton T-Shirt',
      sku: 'CLOTH-001',
      barcode: '1234567890006',
      categoryId: clothingCategory.id,
      retailPrice: 3999,
      wholesalePrice: 2500,
      stockQty: 120,
      supplierId: supplier2.id,
      unit: 'pcs',
      minOrderQty: 5,
    },
    {
      name: 'Denim Jeans',
      sku: 'CLOTH-002',
      barcode: '1234567890007',
      categoryId: clothingCategory.id,
      retailPrice: 8999,
      wholesalePrice: 6000,
      stockQty: 65,
      supplierId: supplier2.id,
      unit: 'pcs',
      minOrderQty: 3,
    },
    {
      name: 'Athletic Shoes',
      sku: 'CLOTH-003',
      barcode: '1234567890008',
      categoryId: clothingCategory.id,
      retailPrice: 12999,
      wholesalePrice: 8500,
      stockQty: 40,
      supplierId: supplier2.id,
      unit: 'pcs',
      minOrderQty: 2,
    },
    {
      name: 'Casual Cap',
      sku: 'CLOTH-004',
      barcode: '1234567890009',
      categoryId: clothingCategory.id,
      retailPrice: 2499,
      wholesalePrice: 1500,
      stockQty: 95,
      supplierId: supplier2.id,
      unit: 'pcs',
      minOrderQty: 6,
    },
    // Food & Beverages (4)
    {
      name: 'Orange Juice 1L',
      sku: 'FOOD-001',
      barcode: '1234567890010',
      categoryId: foodCategory.id,
      retailPrice: 1999,
      wholesalePrice: 1300,
      stockQty: 180,
      supplierId: supplier3.id,
      unit: 'bottle',
      minOrderQty: 12,
    },
    {
      name: 'Whole Wheat Bread',
      sku: 'FOOD-002',
      barcode: '1234567890011',
      categoryId: foodCategory.id,
      retailPrice: 799,
      wholesalePrice: 500,
      stockQty: 75,
      supplierId: supplier3.id,
      unit: 'loaf',
      minOrderQty: 10,
    },
    {
      name: 'Premium Coffee Beans 500g',
      sku: 'FOOD-003',
      barcode: '1234567890012',
      categoryId: foodCategory.id,
      retailPrice: 4999,
      wholesalePrice: 3500,
      stockQty: 35,
      supplierId: supplier3.id,
      unit: 'bag',
      minOrderQty: 4,
    },
    {
      name: 'Chocolate Bar 100g',
      sku: 'FOOD-004',
      barcode: '1234567890013',
      categoryId: foodCategory.id,
      retailPrice: 1299,
      wholesalePrice: 800,
      stockQty: 200,
      supplierId: supplier3.id,
      unit: 'pcs',
      minOrderQty: 20,
    },
    // Health & Beauty (2)
    {
      name: 'Sunscreen SPF50 100ml',
      sku: 'HEALTH-001',
      barcode: '1234567890014',
      categoryId: healthCategory.id,
      retailPrice: 3499,
      wholesalePrice: 2300,
      stockQty: 60,
      supplierId: supplier3.id,
      unit: 'bottle',
      minOrderQty: 6,
    },
    {
      name: 'Moisturizer Cream 50ml',
      sku: 'HEALTH-002',
      barcode: '1234567890015',
      categoryId: healthCategory.id,
      retailPrice: 4999,
      wholesalePrice: 3200,
      stockQty: 48,
      supplierId: supplier3.id,
      unit: 'jar',
      minOrderQty: 6,
    },
    // Stationery (1)
    {
      name: 'Notebook A4 100 pages',
      sku: 'STAT-001',
      barcode: '1234567890016',
      categoryId: stationeryCategory.id,
      retailPrice: 1199,
      wholesalePrice: 700,
      stockQty: 250,
      supplierId: supplier2.id,
      unit: 'pcs',
      minOrderQty: 12,
    },
  ];

  const createdProducts = [];
  for (const product of products) {
    const created = await prisma.product.create({
      data: {
        ...product,
        branchId: branch.id,
        lowStockThreshold: 10,
        isActive: true,
      },
    });
    createdProducts.push(created);
  }

  console.log('Products created:', createdProducts.length);

  // Create Customers
  const retailCustomers = [
    { name: 'John Doe', email: 'john@email.com', phone: '+234-801-111-1111', type: 'RETAIL' as const },
    { name: 'Jane Smith', email: 'jane@email.com', phone: '+234-802-222-2222', type: 'RETAIL' as const },
    { name: 'David Johnson', email: 'david@email.com', phone: '+234-803-333-3333', type: 'RETAIL' as const },
    { name: 'Mary Williams', email: 'mary@email.com', phone: '+234-804-444-4444', type: 'RETAIL' as const },
    { name: 'Robert Brown', email: 'robert@email.com', phone: '+234-805-555-5555', type: 'RETAIL' as const },
  ];

  const wholesaleCustomers = [
    {
      name: 'SuperMart Wholesale',
      email: 'wholesale1@supermart.com',
      phone: '+234-806-666-6666',
      type: 'WHOLESALE' as const,
      creditLimit: 5000000,
    },
    {
      name: 'City Retailers Co',
      email: 'wholesale2@cityretail.com',
      phone: '+234-807-777-7777',
      type: 'WHOLESALE' as const,
      creditLimit: 3000000,
    },
  ];

  for (const customer of retailCustomers) {
    await prisma.customer.create({
      data: { ...customer, branchId: branch.id },
    });
  }

  for (const customer of wholesaleCustomers) {
    await prisma.customer.create({
      data: { ...customer, branchId: branch.id },
    });
  }

  console.log('Customers created');

  // Create sample sales
  const customers = await prisma.customer.findMany({ where: { branchId: branch.id } });

  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < 10; i++) {
    const saleDate = new Date(
      oneWeekAgo.getTime() + Math.random() * (today.getTime() - oneWeekAgo.getTime())
    );

    const customer = customers[Math.floor(Math.random() * customers.length)];
    const paymentMethods: Array<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY'> = [
      'CASH',
      'CARD',
      'BANK_TRANSFER',
      'MOBILE_MONEY',
    ];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

    const numItems = Math.floor(Math.random() * 5) + 1;
    let subtotal = 0;
    const saleItems = [];

    for (let j = 0; j < numItems; j++) {
      const product = createdProducts[Math.floor(Math.random() * createdProducts.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const price =
        customer.type === 'WHOLESALE' ? product.wholesalePrice : product.retailPrice;
      const itemTotal = price * qty;
      subtotal += itemTotal;

      saleItems.push({
        productId: product.id,
        qty,
        unitPrice: price,
        discount: 0,
        total: itemTotal,
      });
    }

    const taxRate = 0.075;
    const tax = subtotal * taxRate;
    const discount = Math.random() > 0.8 ? subtotal * 0.05 : 0;
    const total = subtotal + tax - discount;

    await prisma.sale.create({
      data: {
        customerId: customer.id,
        cashierId: cashier1.id,
        subtotal,
        tax,
        discount,
        total,
        paymentMethod,
        status: 'COMPLETED',
        branchId: branch.id,
        createdAt: saleDate,
        items: {
          create: saleItems,
        },
      },
    });
  }

  console.log('Sample sales created');

  // Create Settings
  const settings = [
    { key: 'businessName', value: 'RetailPro Store', description: 'Business name' },
    { key: 'taxRate', value: '7.5', description: 'Tax rate in percentage' },
    { key: 'eodTime', value: '21:00', description: 'End of day time (HH:mm)' },
    { key: 'ownerEmail', value: 'owner@store.com', description: 'Owner email for reports' },
    { key: 'currency', value: 'NGN', description: 'Currency code' },
    { key: 'lowStockAlert', value: 'true', description: 'Enable low stock alerts' },
    { key: 'businessAddress', value: '123 Commerce Street, Business District', description: 'Business address' },
    { key: 'businessPhone', value: '+234-800-000-0000', description: 'Business phone' },
  ];

  for (const setting of settings) {
    await prisma.setting.create({
      data: setting,
    });
  }

  console.log('Settings created');

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

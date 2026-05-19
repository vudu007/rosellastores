export interface EODReport {
  date: Date;
  totalSalesCount: number;
  totalRevenue: number;
  totalDiscounts: number;
  totalExpenses: number;
  paymentMethodBreakdown: Record<string, { count: number; total: number }>;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  lowStockItems: Array<{
    name: string;
    stockQty: number;
    lowStockThreshold: number;
  }>;
  previousDaySalesCount: number;
}

export interface DashboardStats {
  todaySales: number;
  yesterdaySales: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  weekRevenue: number;
  prevWeekRevenue: number;
  monthRevenue: number;
  todayTax: number;
  monthTax: number;
  todayExpenses: number;
  monthExpenses: number;
  monthNetProfit: number;
  lowStockCount: number;
  salesTrend: ChartData[];
  categoryDistribution: CategoryData[];
}

export interface ChartData {
  date: string;
  revenue: number;
  count: number;
}

export interface CategoryData {
  name: string;
  value: number;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: { name: string } | null;
  createdAt: string | Date;
  tempExpiresAt?: string | Date | null;
}

export interface Branch {
  id: string;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: 'RETAIL';
  creditLimit: number | null;
  creditUsed: number;
}

export type SaleType = 'RETAIL';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcodes: string[];
  categoryId: string;
  retailPrice: number;
  wholesalePrice?: number;
  stockQty: number;
  lowStockThreshold: number;
  unitsPerPack?: number;
  wholesaleUnit?: string;
  unit: string;
  isActive: boolean;
  branchId: string;
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface CreateSaleInput {
  customerId?: string;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'SPLIT';
  items: SaleItemInput[];
  discount: number;
  notes?: string;
}

export interface ProductCreateInput {
  name: string;
  sku: string;
  barcodes?: string[];
  categoryId: string;
  retailPrice: number;
  wholesalePrice?: number;
  stockQty: number;
  lowStockThreshold?: number;
  unitsPerPack?: number;
  wholesaleUnit?: string;
  supplierId: string;
  imageUrl?: string;
  unit?: string;
  minOrderQty?: number;
}

export interface CustomerCreateInput {
  name: string;
  email?: string;
  phone?: string;
}

export interface ExpenseCreateInput {
  category: string;
  amount: number;
  description: string;
  date: Date;
}

export interface InventoryAdjustmentInput {
  productId: string;
  quantityChange: number;
  reason: string;
}

export type UserRole = 'ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  branchId: string | null;
}

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
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  lowStockCount: number;
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface CreateSaleInput {
  customerId: string;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY';
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
  wholesalePrice: number;
  stockQty: number;
  lowStockThreshold?: number;
  supplierId: string;
  imageUrl?: string;
  unit?: string;
  minOrderQty?: number;
}

export interface CustomerCreateInput {
  name: string;
  email?: string;
  phone?: string;
  type: 'RETAIL' | 'WHOLESALE';
  creditLimit?: number;
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

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'WHOLESALE_CUSTOMER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  branchId: string | null;
}

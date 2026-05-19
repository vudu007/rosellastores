import { prisma } from '@/lib/prisma';
import { CustomerCreateInput } from '@/types';

export class CustomerService {
  static async getCustomers(params: {
    branchId?: string;
    search?: string | null;
    page?: number;
    limit?: number;
  }) {
    const { branchId, search, page = 1, limit = 20 } = params;

    const where: any = {
      branchId: branchId ?? undefined,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async createCustomer(data: CustomerCreateInput & { branchId: string }) {
    return prisma.customer.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        branchId: data.branchId,
      },
    });
  }

  static async updateCustomer(id: string, data: Partial<CustomerCreateInput>) {
    return prisma.customer.update({
      where: { id },
      data,
    });
  }

  static async deleteCustomer(id: string) {
    return prisma.customer.delete({
      where: { id },
    });
  }
}

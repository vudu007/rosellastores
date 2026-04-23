import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@/types';

export class StaffService {
  static async getStaff(currentUserRole: string, branchId?: string | null) {
    const where: any = {};
    if (currentUserRole === 'MANAGER' && branchId) {
      where.branchId = branchId;
    }

    const staff = await prisma.user.findMany({
      where,
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
    });

    return staff.map(({ password, ...rest }) => rest);
  }

  static async createStaff(data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    branchId?: string | null;
    tempAccount?: boolean;
  }) {
    const { name, email, password, role, branchId, tempAccount } = data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const tempExpiresAt = tempAccount ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        branchId: branchId || null,
        ...(tempExpiresAt ? { tempExpiresAt } : {}),
      },
    });

    const { password: _, ...safeUser } = newUser;
    return safeUser;
  }

  static async updateStaff(id: string, data: {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    branchId?: string | null;
    tempAccount?: boolean;
  }) {
    const { name, email, password, role, branchId, tempAccount } = data;

    const updateData: any = { name, email, role, branchId: branchId || null };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    if (tempAccount) {
      updateData.tempExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else {
      updateData.tempExpiresAt = null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    const { password: _, ...safeUser } = updated;
    return safeUser;
  }

  static async deleteStaff(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }
}

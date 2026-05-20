'use server';

import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { StaffService } from '@/services/staff.service';
import { UserRole } from '@/types';
import { revalidatePath } from 'next/cache';

export async function createStaffAction(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  branchId?: string | null;
  tempAccount?: boolean;
}) {
  const session = await authWithSession();
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  const staff = await StaffService.createStaff(data);
  revalidatePath('/dashboard/staff');
  return staff;
}

export async function updateStaffAction(id: string, data: {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  branchId?: string | null;
  tempAccount?: boolean;
}) {
  const session = await authWithSession();
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  // Protection for ADMIN accounts
  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (targetUser?.role === 'ADMIN' && session.user.role !== 'ADMIN') {
    throw new Error('Only Admins can modify other Admin accounts');
  }

  const staff = await StaffService.updateStaff(id, data);
  revalidatePath('/dashboard/staff');
  return staff;
}

export async function deleteStaffAction(id: string) {
  const session = await authWithSession();
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  if (id === session.user.id) {
    throw new Error('You cannot delete your own account');
  }

  // Protection for ADMIN accounts
  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (targetUser?.role === 'ADMIN' && session.user.role !== 'ADMIN') {
    throw new Error('Only Admins can delete other Admin accounts');
  }

  await StaffService.deleteStaff(id);
  revalidatePath('/dashboard/staff');
  return { success: true };
}

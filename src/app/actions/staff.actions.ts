'use server';

import { auth } from '@/lib/auth';
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
  const session = await auth();
  if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  // Protection for ADMIN accounts
  if (data.role === 'ADMIN' && session.user.role !== 'ADMIN') {
    throw new Error('Only Admins can create other Admin accounts');
  }

  if (session.user.role === 'OWNER' && data.role === 'ADMIN') {
    throw new Error('Owners cannot create Admin accounts');
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
  const session = await auth();
  if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  // Protection for ADMIN accounts
  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (targetUser?.role === 'ADMIN' && session.user.role !== 'ADMIN') {
    throw new Error('Only Admins can modify other Admin accounts');
  }

  if (session.user.role === 'OWNER' && data.role === 'ADMIN') {
    throw new Error('Owners cannot assign the Admin role');
  }

  const staff = await StaffService.updateStaff(id, data);
  revalidatePath('/dashboard/staff');
  return staff;
}

export async function deleteStaffAction(id: string) {
  const session = await auth();
  if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
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

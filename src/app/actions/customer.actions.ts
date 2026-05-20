'use server';

import { authWithSession } from '@/lib/authz';
import { CustomerService } from '@/services/customer.service';
import { CustomerCreateInput } from '@/types';
import { revalidatePath } from 'next/cache';

export async function createCustomerAction(data: CustomerCreateInput) {
  const session = await authWithSession();
  if (!session || !['CASHIER', 'MANAGER', 'OWNER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  const customer = await CustomerService.createCustomer({
    ...data,
    branchId: session.user.branchId!,
  });

  revalidatePath('/dashboard/customers');
  return customer;
}

export async function updateCustomerAction(id: string, data: Partial<CustomerCreateInput>) {
  const session = await authWithSession();
  if (!session || !['MANAGER', 'OWNER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  const customer = await CustomerService.updateCustomer(id, data);
  revalidatePath('/dashboard/customers');
  return customer;
}

export async function deleteCustomerAction(id: string) {
  const session = await authWithSession();
  if (!session || !['MANAGER', 'OWNER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  await CustomerService.deleteCustomer(id);
  revalidatePath('/dashboard/customers');
  return { success: true };
}

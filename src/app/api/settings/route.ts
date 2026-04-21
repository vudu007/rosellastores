export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc, current) => {
      acc[current.key] = current.value;
      return acc;
    }, {} as Record<string, string>);

    const res = NextResponse.json(settingsMap);
    // Settings change rarely — cache in browser for 60s
    res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
    return res;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized. Only OWNER can update settings' }, { status: 401 });
    }

    const body = await req.json();
    
    // Upsert each setting
    const operations = Object.entries(body).map(([key, value]) => {
      // Basic type validation: value must be string, if it's not, convert it.
      const stringValue = String(value);

      return prisma.setting.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue },
      });
    });

    await prisma.$transaction(operations);

    return NextResponse.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


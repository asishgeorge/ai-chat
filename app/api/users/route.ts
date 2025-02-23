import { NextResponse } from 'next/server';
import prisma from '@/lib/primsa';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  try {
    let user = await prisma.user.findUnique({
      where: { email: email ?? undefined },
    });

    // If user doesn't exist, create one
    if (!user) {
      user = await prisma.user.create({
        data: { email: email! },
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.log('error', error);
    return NextResponse.json({ error: 'Failed to fetch/create user' }, { status: 500 });
  }
} 
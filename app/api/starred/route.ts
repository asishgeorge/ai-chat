import { NextResponse } from 'next/server';
import prisma from '@/lib/primsa';

export async function POST(req: Request) {
  const body = await req.json();
  const { messageId, userId } = body;

  try {
    const starred = await prisma.starred.create({
      data: { messageId, userId },
    });
    return NextResponse.json(starred);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to star message' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  try {
    const starredMessages = await prisma.starred.findMany({
      where: { userId: userId ?? undefined },
      include: { message: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(starredMessages);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch starred messages' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const starredId = searchParams.get('starredId');

  if (!starredId) {
    return NextResponse.json({ error: 'Starred ID is required' }, { status: 400 });
  }

  try {
    await prisma.starred.delete({
      where: {
        id: starredId,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to unstar message' }, { status: 500 });
  }
} 
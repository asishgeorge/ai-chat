import { NextResponse } from 'next/server';
import prisma from '@/lib/primsa';

export async function POST(req: Request) {
  const body = await req.json();
  const { content, sender, chatId, llm, status = 'PENDING' } = body;

  try {
    const message = await prisma.message.create({
      data: { chatId, content, sender, llm, status },
    });
    return NextResponse.json(message);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');

  try {
    const messages = await prisma.message.findMany({
      where: { chatId: chatId ?? undefined },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, content } = body;

  try {
    const message = await prisma.message.update({
      where: { id },
      data: { content },
    });
    return NextResponse.json(message);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
} 
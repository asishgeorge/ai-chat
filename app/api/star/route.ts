import { NextRequest, NextResponse } from "next/server";
import prisma from '@/lib/primsa';
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { messageId, userId, starred } = await req.json();

    // Validate required fields
    if (!messageId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if the message exists and belongs to the user
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        chat: {
          userId: userId
        }
      }
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message not found or unauthorized" },
        { status: 404 }
      );
    }

    if (starred) {
      // Create star record
      await prisma.starred.create({
        data: {
          userId,
          messageId
        }
      });
    } else {
      // Remove star record
      await prisma.starred.delete({
        where: {
          userId_messageId: {
            userId,
            messageId
          }
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in star message API:", error);
    // If the error is due to duplicate starring or star not found, return 400
    if(error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' || error.code === 'P2025') {
        return NextResponse.json(
          { error: "Invalid star operation" },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to update message star status" },
      { status: 500 }
    );
  }
}


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    const starredMessages = await prisma.starred.findMany({
      where: {
        userId: userId
      },
      select: {
        messageId: true,
        message: { // Associate with messages table
          select: {
            id: true,
            content: true,
            sender: true,
            createdAt: true,
            llm: true,
          }
        }
      }
    });

    return NextResponse.json({ 
      starredMessages: starredMessages
    });
  } catch (error) {
    console.error("Error fetching starred messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch starred messages" },
      { status: 500 }
    );
  }
}
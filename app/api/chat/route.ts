import { NextResponse } from 'next/server';
import prisma from '@/lib/primsa';
import { simulateLLMStreaming } from '@/lib/generator';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const chatId = searchParams.get('chatId');


  try {
    const chats = await prisma.chat.findMany({
      where: { userId: userId ?? undefined, id: chatId ?? undefined },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    return NextResponse.json(chats);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
} 


export async function POST(req: Request) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    let writerClosed = false;

    const closeWriter = async () => {
        if (!writerClosed) {
            writerClosed = true;
            try {
                await writer.close();
            } catch (error) {
                console.log('Error closing writer:', error);
            }
        }
    };

    try {
        // Validate request body
        const body = await req.json();
        if (!body || typeof body !== 'object') {
            throw new Error('Invalid request body');
        }

        const { chat_id, message, user_id } = body;

        let chatId = chat_id;
        if (!chatId) {
            // create a new chat 
            const newChat = await prisma.chat.create({
                data: { userId: user_id }
            });
            
            chatId = newChat.id;
        }

        // Create user message first
        const userMessage = await prisma.message.create({
            data: {
                chatId,
                content: message,
                sender: 'USER',
                status: 'COMPLETED',
                llm: null
            },
        });

        // Create assistant message
        const assistantMessage = await prisma.message.create({
            data: {
                chatId,
                content: '',
                sender: 'AI',
                status: 'PENDING',
                llm: null
            },
        });

        // Start streaming response
        const response = new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

        // Process in background
        (async () => {
            try {
                let fullContent = '';
                let isFirstChunk = true;
                
                // Add abort handler
                const signal = req.signal;
                signal?.addEventListener('abort', async () => {
                    await prisma.message.update({
                        where: { id: assistantMessage.id },
                        data: { 
                            content: fullContent,
                            status: 'INTERRUPTED'
                        },
                    });

                    const interruptData = {
                        type: 'interrupt',
                        messageId: assistantMessage.id,
                        finalContent: fullContent
                    };
                    
                    if (!writerClosed) {
                        await writer.write(
                            encoder.encode(`data: ${JSON.stringify(interruptData)}\n\n`)
                        );
                        await closeWriter();
                    }
                });

                // Stream each chunk if not aborted
                for await (const chunk of simulateLLMStreaming(message, { 
                    delayMs: 200, 
                    chunkSize: 12, 
                    stop: false 
                })) {
                    if (signal?.aborted || writerClosed) break;

                    fullContent += chunk;
                    
                    if (isFirstChunk) {
                        // Send first chunk with both message IDs
                        const initialData = {
                            type: 'chunk',
                            content: chunk,
                            messageId: assistantMessage.id,
                            userMessageId: userMessage.id,
                            chatId: chatId
                        };
                        
                        await writer.write(
                            encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`)
                        );
                        isFirstChunk = false;
                    } else {
                        // Send regular chunks
                        const data = {
                            type: 'chunk',
                            content: chunk,
                            messageId: assistantMessage.id,
                        };
                        
                        await writer.write(
                            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                        );
                    }
                }

                // Only update and send completion if not aborted
                if (!signal?.aborted && !writerClosed) {
                    await prisma.message.update({
                        where: { id: assistantMessage.id },
                        data: { 
                            content: fullContent,
                            status: 'COMPLETED'
                        },
                    });

                    const data = {
                        type: '[DONE]',
                    }

                    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    await closeWriter();
                }
            } catch (error) {
                console.error('Streaming error:', error);
                if (!writerClosed) {
                    const errorData = {
                        type: 'error',
                        error: 'An error occurred while streaming the response',
                    };
                    await writer.write(
                        encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
                    );
                    await closeWriter();
                }
            }
        })();

        return response;
    } catch (error) {
        await closeWriter();
        console.error('API error:', error instanceof Error ? error.message : 'Unknown error');
        return new Response(
            JSON.stringify({ 
                error: error instanceof Error ? error.message : 'Failed to process request' 
            }), 
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
}
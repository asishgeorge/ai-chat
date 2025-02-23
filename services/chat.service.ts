import { Message as PrismaMessage } from '@prisma/client';

export const startChatStream = async (
  message: string, 
  userId: string, 
  chatId: string, 
  model: string, 
  signal: AbortSignal
) => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message, user_id: userId, model }),
    signal
  });

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response;
};

export const createTempUserMessage = (content: string, chatId: string): PrismaMessage => ({
  id: 'temp-user-' + Date.now(),
  content,
  sender: 'USER',
  chatId: chatId || 'temp-chat',
  createdAt: new Date(),
  status: 'COMPLETED',
  llm: null
}); 
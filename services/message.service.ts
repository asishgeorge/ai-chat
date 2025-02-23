import { Message as PrismaMessage } from '@prisma/client';

export const handleInitialChunk = (
  data: any,
  tempUserMessage: PrismaMessage
): PrismaMessage[] => {
  const assistantMessage = {
    id: data.messageId,
    content: data.content || '',
    sender: 'AI',
    chatId: data.chatId,
    createdAt: new Date(),
    status: 'PENDING',
    llm: null
  } as PrismaMessage;

  return [
    {
      ...tempUserMessage,
      id: data.userMessageId,
      chatId: data.chatId
    },
    assistantMessage
  ];
};

export const handleStreamData = {
  interrupt: (messages: PrismaMessage[], data: any, assistantMessageId: string | null): PrismaMessage[] => {
    if (!assistantMessageId) return messages;
    return messages.map(msg =>
      msg.id === assistantMessageId
        ? {
            ...msg,
            content: data.finalContent,
            status: 'INTERRUPTED'
          }
        : msg
    );
  },

  error: (messages: PrismaMessage[], assistantMessageId: string | null): PrismaMessage[] => {
    if (!assistantMessageId) return messages;
    return messages.filter(msg => msg.id !== assistantMessageId);
  },

  done: (messages: PrismaMessage[], assistantMessageId: string | null): PrismaMessage[] => {
    if (!assistantMessageId) return messages;
    return messages.map(msg =>
      msg.id === assistantMessageId
        ? { ...msg, status: 'COMPLETED' }
        : msg
    );
  }
}; 
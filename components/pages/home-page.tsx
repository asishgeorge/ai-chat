'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { ModeToggle } from '../elements/toggle-mode';
import { CircleSlash, RotateCcw, Bot, User } from 'lucide-react';
import { Input } from '../ui/input';
import { ModelOptions } from '../elements/model-options';
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm'
import { useLLMStore } from '@/store/llm-store';
import { Message as PrismaMessage } from '@prisma/client';
import { models, Model } from '@/helper/models';

export default function HomePage() {
  const [messages, setMessages] = useState<PrismaMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const streamingOptions = useRef<{ stop: boolean }>({ stop: false });
  const [chatId, setChatId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { setSelectedModel } = useLLMStore();

  const model = useLLMStore().selectedModel;
  const defaultEmail = 'default@example.com';

  useEffect(() => {
    // get user from email 
    fetch('/api/users?email=' + encodeURIComponent(defaultEmail))
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch user');
        return res.json();
      })
      .then(data => {
        if (data.error) throw new Error(data.error);
        console.log('data', data);
        setUserId(data.id);
      })
      .catch(err => {
        console.error('Error:', err);
      });
  }, [defaultEmail]);

  useEffect(() => {
    // Set the first model as the default selected model on page load
    if (models.length > 0) {
      setSelectedModel(models[0].id); // Assuming models have an 'id' property
    }
  }, []);

  const handleSendMessage = async () => {
    if (!userId || !input.trim()) return;
    
    const abortController = new AbortController();
    setLoading(true);
    streamingOptions.current.stop = false;

    const userMessage = createTempUserMessage(input.trim(), chatId);
    setInput('');
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await startChatStream(userMessage.content, userId, chatId, model, abortController.signal);
      await processStreamResponse(response, userMessage, abortController);
    } catch (error) {
      console.error('Streaming error:', error);
    } finally {
      setLoading(false);
      streamingOptions.current.stop = false;
    }
  };

  const createTempUserMessage = (content: string, chatId: string): PrismaMessage => ({
    id: 'temp-user-' + Date.now(),
    content,
    sender: 'USER',
    chatId: chatId || 'temp-chat',
    createdAt: new Date(),
    status: 'COMPLETED',
    llm: null
  });

  const startChatStream = async (message: string, userId: string, chatId: string, model: string, signal: AbortSignal) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message, user_id: userId, model }),
      signal
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response;
  };

  const processStreamResponse = async (response: Response, tempUserMessage: PrismaMessage, abortController: AbortController) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error('No reader available');

    let isFirstChunk = true;
    let assistantMessageId: string | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done || streamingOptions.current.stop) break;

      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        const data = JSON.parse(line.slice(6));
        await handleStreamData(data, isFirstChunk, tempUserMessage, assistantMessageId);
        
        if (data.type === 'chunk' && isFirstChunk) {
          isFirstChunk = false;
          assistantMessageId = data.messageId;
        }
      }
    }

    if (streamingOptions.current.stop) {
      abortController.abort();
    }
  };

  const handleStreamData = async (
    data: any, 
    isFirstChunk: boolean, 
    tempUserMessage: PrismaMessage, 
    assistantMessageId: string | null
  ) => {
    switch (data.type) {
      case 'chunk':
        handleChunkData(data, isFirstChunk, tempUserMessage, assistantMessageId);
        break;
      case 'interrupt':
        handleInterruptData(data, assistantMessageId);
        break;
      case 'error':
        handleErrorData(data, assistantMessageId);
        break;
      case '[DONE]':
        handleDoneData(assistantMessageId);
        break;
    }
  };

  const handleInitialChunk = (
    data: any,
    tempUserMessage: PrismaMessage
  ) => {
    const assistantMessage = {
      id: data.messageId,
      content: data.content || '',
      sender: 'AI',
      chatId: data.chatId,
      createdAt: new Date(),
      status: 'PENDING',
      llm: null
    } as PrismaMessage;

    setMessages(prev => [
      ...prev.filter(msg => msg.id !== tempUserMessage.id),
      {
        ...tempUserMessage,
        id: data.userMessageId,
        chatId: data.chatId
      },
      assistantMessage
    ]);
    
    setChatId(data.chatId);
    return data.messageId;
  };

  const handleSubsequentChunk = (
    data: any,
    assistantMessageId: string
  ) => {
    setMessages(prev => {
      const updatedMessages = prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: msg.content + data.content }
          : msg
      );
      return [...updatedMessages];
    });
  };

  const handleChunkData = (
    data: any, 
    isFirstChunk: boolean, 
    tempUserMessage: PrismaMessage, 
    assistantMessageId: string | null
  ) => {
    return isFirstChunk 
      ? handleInitialChunk(data, tempUserMessage)
      : handleSubsequentChunk(data, assistantMessageId!);
  };

  const handleInterruptData = (
    data: any, 
    assistantMessageId: string | null
  ) => {
    if (assistantMessageId) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { 
              ...msg, 
              content: data.finalContent,
              status: 'INTERRUPTED' 
            }
          : msg
      ));
    }
  };

  const handleErrorData = (
    data: any, 
    assistantMessageId: string | null
  ) => {
    console.error('Error in stream:', data.error);
    if (assistantMessageId) {
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    }
  };

  const handleDoneData = (
    assistantMessageId: string | null
  ) => {
    if (assistantMessageId) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { ...msg, status: 'COMPLETED' }
          : msg
      ));
    }
  };

  const handleStop = () => {
    streamingOptions.current.stop = true;
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="max-w-7xl relative mx-auto h-[100dvh] flex flex-col items-center space-y-12">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <h1 className="font-bold text-2xl">{model.length ? model : 'Chat with me'}</h1>

      <div className="relative max-w-xl w-full p-4 border rounded-md flex flex-col h-[70vh]">
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex flex-row items-start gap-2 ${message.sender === 'AI' ? 'justify-start' : 'justify-end'}`}>
                {message.sender === 'AI' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <Bot size={18} />
                  </div>
                )}
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.sender === 'AI' 
                    ? 'bg-secondary' 
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {message.sender === 'AI' ? (
                    <Markdown className='prose dark:prose-invert prose-h1:text-xl prose-sm' remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </Markdown>
                  ) : (
                    message.content
                  )}
                </div>
                {message.sender === 'USER' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <User size={18} />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className='sticky bottom-0 right-0 flex gap-2 justify-end pt-2'>
          {loading && (
            <Button onClick={handleStop} variant="outline" size="icon">
              <CircleSlash />
            </Button>
          )}

          <Button
            disabled={loading || messages.length === 0}
            onClick={() => {
              setMessages([]);
            }}
            variant="outline"
            size="icon"
          >
            <RotateCcw />
          </Button>
        </div>
      </div>

      <div className="max-w-xl w-full fixed bottom-5">
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage() }} className="flex flex-row w-full items-end gap-2">
          <ModelOptions />
          <Input
            placeholder="Type your message here."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type='submit' disabled={loading || !input.length}>
            {loading ? 'Sending...' : 'Send message'}
          </Button>
        </form>
      </div>
    </div>
  );
}
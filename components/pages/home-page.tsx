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
import { simulatedResponse } from '@/helper/helper';
import { Message as PrismaMessage } from '@prisma/client';

export default function HomePage() {
  const [messages, setMessages] = useState<PrismaMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const streamingOptions = useRef<{ stop: boolean }>({ stop: false });
  const [chatId, setChatId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userId) return;
    
    const abortController = new AbortController();
    setLoading(true);
    streamingOptions.current.stop = false;
    
    const userMessage = input.trim();
    if (!userMessage) {
      setLoading(false);
      return;
    }

    // Clear input and immediately add user message
    setInput('');
    const tempUserMessage = {
      id: 'temp-user-' + Date.now(),
      content: userMessage,
      sender: 'USER',
      chatId: chatId || 'temp-chat',
      createdAt: new Date(),
      status: 'COMPLETED',
      llm: null
    } as PrismaMessage;
    
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      // Start streaming from the API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          message: userMessage,
          user_id: userId,
          model: model
        }),
        signal: abortController.signal
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
  
      if (!reader) {
        throw new Error('No reader available');
      }
  
      let isFirstChunk = true;
      let assistantMessageId: string | null = null;
  
      // Read the stream
      while (true) {
        const { value, done } = await reader.read();
        if (done || streamingOptions.current.stop) break;
  
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
  
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
  
            switch (data.type) {
              case 'chunk':
                if (isFirstChunk) {
                  // Immediately create the assistant message with initial content
                  const assistantMessage = {
                    id: data.messageId,
                    content: data.content || '',
                    sender: 'AI',
                    chatId: data.chatId,
                    createdAt: new Date(),
                    status: 'PENDING',
                    llm: null
                  } as PrismaMessage;

                  // Update messages with both user and assistant messages
                  setMessages(prev => [
                    ...prev.filter(msg => msg.id !== tempUserMessage.id),
                    {
                      ...tempUserMessage,
                      id: data.userMessageId,
                      chatId: data.chatId
                    },
                    assistantMessage
                  ]);
                  
                  assistantMessageId = data.messageId;
                  setChatId(data.chatId);
                  isFirstChunk = false;
                } else {
                  // Force immediate state update for each chunk
                  setMessages(prev => {
                    const updatedMessages = prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + data.content }
                        : msg
                    );
                    return [...updatedMessages];
                  });
                }
                break;
  
              case 'interrupt':
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
                return;
  
              case 'error':
                console.error('Error in stream:', data.error);
                if (assistantMessageId) {
                  // Remove the assistant message if there was an error
                  setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
                }
                return;
  
              case '[DONE]':
                if (assistantMessageId) {
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId
                      ? { ...msg, status: 'COMPLETED' }
                      : msg
                  ));
                }
                return;
            }
          }
        }
      }
  
      if (streamingOptions.current.stop) {
        abortController.abort();
      }
  
    } catch (error) {
      console.error('Streaming error:', error);
      // setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
      streamingOptions.current.stop = false;
    }
  };

  const handleStop = () => {
    streamingOptions.current.stop = true;
    setLoading(false);
  };

  return (
    <div className="max-w-7xl relative mx-auto h-[100dvh] flex flex-col justify-center items-center space-y-12">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <h1 className="font-bold text-2xl">{model.length ? model : 'Chat with me'}</h1>

      <div className="relative max-w-xl w-full p-4 border rounded-md flex flex-col h-96">
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
'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { CircleSlash, RotateCcw, Bot, User, Star } from 'lucide-react';
import { Input } from '../ui/input';
import { ModelOptions } from '../elements/model-options';
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm'
import { useLLMStore } from '@/store/llm-store';
import { Message as PrismaMessage } from '@prisma/client';
import { models } from '@/helper/models';
import { startChatStream, createTempUserMessage } from '@/services/chat.service';
import { handleInitialChunk, handleStreamData } from '@/services/message.service';
import { useUserStore } from '@/store/user-store';
import { useRouter } from 'next/navigation';
import { Header } from '../elements/header';

export default function HomePage() {
  const [messages, setMessages] = useState<PrismaMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const streamingOptions = useRef<{ stop: boolean }>({ stop: false });
  const [chatId, setChatId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [starredMessages, setStarredMessages] = useState<string[]>([]);
  const { user } = useUserStore();
  const router = useRouter();

  const { setSelectedModel } = useLLMStore();

  const model = useLLMStore().selectedModel;

  useEffect(() => {
    console.log('user', user);
    if (!user.id) {
      // go to login page
      router.push('/login');
    }
    // Set the first model as the default selected model on page load
    if (models.length > 0) {
      setSelectedModel(models[0].id); // Assuming models have an 'id' property
    }

    setUserId(user.id);

  }, []);

  useEffect(() => {
    if (userId) {
      fetch(`/api/star?userId=${userId}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch starred messages');
          return res.json();
        })
        .then(data => {
          if (data.starredMessages) {
            setStarredMessages(data.starredMessages);
          }
        })
        .catch(error => {
          console.error('Error fetching starred messages:', error);
        });
    }
  }, [userId]);

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
        
        if (data.type === 'chunk') {
          if (isFirstChunk) {
            const newMessages = handleInitialChunk(data, tempUserMessage);
            setMessages(prev => [...prev.filter(msg => msg.id !== tempUserMessage.id), ...newMessages]);
            setChatId(data.chatId);
            assistantMessageId = data.messageId;
            isFirstChunk = false;
          } else {
            setMessages(prev => {
              const updatedMessages = prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + data.content }
                  : msg
              );
              return [...updatedMessages];
            });
          }
        } else if (data.type === 'interrupt') {
          setMessages(prev => handleStreamData.interrupt(prev, data, assistantMessageId));
        } else if (data.type === 'error') {
          console.error('Error in stream:', data.error);
          setMessages(prev => handleStreamData.error(prev, assistantMessageId));
        } else if (data.type === '[DONE]') {
          setMessages(prev => handleStreamData.done(prev, assistantMessageId));
        }
      }
    }

    if (streamingOptions.current.stop) {
      abortController.abort();
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

  const toggleStarMessage = async (messageId: string) => {
    try {
      const response = await fetch('/api/star', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          userId,
          starred: !starredMessages.includes(messageId)
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle star status');
      }

      // Update local state only after successful API call
      setStarredMessages(prev => 
        prev.includes(messageId) 
          ? prev.filter(id => id !== messageId) 
          : [...prev, messageId]
      );
    } catch (error) {
      console.error('Error toggling star status:', error);
      // You might want to add a toast notification here to show the error to the user
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="w-full flex-1 max-w-7xl relative mx-auto flex flex-col items-center space-y-12 py-12">
        <h1 className="font-bold text-2xl">{model.length ? model : 'Chat with me'}</h1>

        <div className="relative max-w-xl w-full p-4 border rounded-md flex flex-col h-[70vh]">
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex flex-row items-start gap-2 ${message.sender === 'AI' ? 'justify-start' : 'justify-end'}`}>
                  <button onClick={() => toggleStarMessage(message.id)} className={`star-button ${starredMessages.includes(message.id) ? 'starred' : ''}`}>
                    <Star className={`w-5 h-5 ${starredMessages.includes(message.id) ? 'text-yellow-500' : 'text-gray-500'}`} />
                  </button>
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
    </div>
  );
}
'use client';
import React, { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { ModeToggle } from '../elements/toggle-mode';
import { simulateLLMStreaming } from '@/lib/generator';
import { CircleSlash, RotateCcw, Bot, User } from 'lucide-react';
import { Input } from '../ui/input';
import { ModelOptions } from '../elements/model-options';
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm'
import { useLLMStore } from '@/store/llm-store';
import { simulatedResponse } from '@/helper/helper';

interface Message {
  type: 'user' | 'assistant';
  content: string;
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const streamingOptions = useRef<{ stop: boolean }>({ stop: false });

  const model = useLLMStore().selectedModel;

  const handleSendMessage = async () => {
    setLoading(true);
    streamingOptions.current.stop = false;
    
    // Add user message immediately
    const userMessage = input;
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    setInput(''); // Clear input after sending
    
    // Create a new assistant message
    const newAssistantMessage: Message = { type: 'assistant', content: '' };
    setMessages(prev => [...prev, newAssistantMessage]);

    // Stream the response
    let processedLength = 0;
    for await (const chunk of simulateLLMStreaming(simulatedResponse, { delayMs: 200, chunkSize: 12, stop: streamingOptions.current.stop })) {
      if (streamingOptions.current.stop) break;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = simulatedResponse.slice(0, processedLength + chunk.length);
        return updated;
      });
      processedLength += chunk.length;
    }

    setLoading(false);
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
              <div key={index} className={`flex flex-row items-start gap-2 ${message.type === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <Bot size={18} />
                  </div>
                )}
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === 'assistant' 
                    ? 'bg-secondary' 
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {message.type === 'assistant' ? (
                    <Markdown className='prose dark:prose-invert prose-h1:text-xl prose-sm' remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </Markdown>
                  ) : (
                    message.content
                  )}
                </div>
                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <User size={18} />
                  </div>
                )}
              </div>
            ))}
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
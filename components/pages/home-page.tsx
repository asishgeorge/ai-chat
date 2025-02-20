'use client';
import React, { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { ModeToggle } from '../elements/toggle-mode';
import { simulateLLMStreaming } from '@/lib/generator';
import { CircleSlash, RotateCcw } from 'lucide-react';
import { Input } from '../ui/input';
import { ModelOptions } from '../elements/model-options';
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm'
import { useLLMStore } from '@/store/llm-store';
import { simulatedResponse } from '@/helper/helper';
export default function HomePage() {
  
  const [result, setResult] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const streamingOptions = useRef<{ stop: boolean }>({ stop: false });

  const model = useLLMStore().selectedModel
  const handleSendMessage = async () => {
    setLoading(true);
    setResult(''); 
    streamingOptions.current.stop = false; 


    for await (const chunk of simulateLLMStreaming(simulatedResponse, { delayMs: 200, chunkSize: 12, stop: streamingOptions.current.stop })) {
      if (streamingOptions.current.stop) break;
      setResult((prev) => prev + chunk);
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

      <div className="relative max-w-xl w-full p-4 border rounded-md flex flex-col h-96 overflow-y-auto">
        <div className="flex flex-row justify-between items-start">
          <div className='w-4/5'>
            <Markdown className='prose dark:prose-invert prose-h1:text-xl prose-sm' remarkPlugins={[remarkGfm]}>{result || 'No response yet.'}</Markdown>
          </div>
          <div className='1/5 sticky top-0 right-0 flex gap-2'>

            {loading && <Button
              onClick={handleStop}
              variant="outline" size="icon">
              <CircleSlash />
            </Button>}

            <Button
              disabled={loading || !result.length}
              onClick={() => {
                setResult('');
              }} variant="outline" size="icon">
              <RotateCcw />
            </Button>

          </div>
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
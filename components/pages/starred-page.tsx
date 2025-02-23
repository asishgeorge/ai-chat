'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bot, User } from 'lucide-react';
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import { useUserStore } from '@/store/user-store';
import { useRouter } from 'next/navigation';

interface StarredMessage {
  message: {
    id: string;
    content: string;
    sender: string;
    createdAt: string;
    llm: string;
  }
}

export default function StarredPage() {
  const { user } = useUserStore();
  const [starredMessages, setStarredMessages] = useState<StarredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  
  useEffect(() => {
    if (!user.id) {
      // go to login page
      router.push('/login');
    }
  }, []);

  useEffect(() => {
    const fetchStarredMessages = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`/api/star?userId=${user.id}`);
        const data = await response.json();
        console.log('data', data);
        setStarredMessages(data.starredMessages);
      } catch (error) {
        console.error('Error fetching starred messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStarredMessages();
  }, [user?.id]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Starred Messages</h1>
      </div>

      {starredMessages.length === 0 ? (
        <div className="text-center text-muted-foreground">
          No starred messages yet
        </div>
      ) : (
        <div className="space-y-6">
          {starredMessages.map((starred) => (
            <div key={starred.message.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  {new Date(starred.message.createdAt).toLocaleString()}
                </span>
                {/* <Link 
                  href={`/?chatId=${starred.message.chat.id}`}
                  className="text-sm text-blue-500 hover:underline"
                >
                  View in Chat
                </Link> */}
              </div>
              <div className={`flex flex-row items-start gap-2 ${
                starred.message.sender === 'AI' ? 'justify-start' : 'justify-end'
              }`}>
                {starred.message.sender === 'AI' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <Bot size={18} />
                  </div>
                )}
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  starred.message.sender === 'AI' 
                    ? 'bg-secondary' 
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {starred.message.sender === 'AI' ? (
                    <Markdown className='prose dark:prose-invert prose-h1:text-xl prose-sm' remarkPlugins={[remarkGfm]}>
                      {starred.message.content}
                    </Markdown>
                  ) : (
                    starred.message.content
                  )}
                </div>
                {starred.message.sender === 'USER' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <User size={18} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
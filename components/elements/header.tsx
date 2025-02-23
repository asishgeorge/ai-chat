'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ModeToggle } from './toggle-mode';
import { Button } from '../ui/button';
import { useUserStore } from '@/store/user-store';
import { Home, Star } from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useUserStore();

  const handleLogout = () => {
    clearUser();
    router.push('/login');
  };

  const navigation = [
    {
      name: 'Home',
      href: '/',
      icon: Home,
      active: pathname === '/'
    },
    {
      name: 'Starred',
      href: '/starred',
      icon: Star,
      active: pathname === '/starred'
    }
  ];

  return (
    <header className="w-full border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          {/* Navigation */}
          <nav className="flex items-center space-x-4">
            {navigation.map((item) => (
              <Button
                key={item.name}
                variant={item.active ? "default" : "ghost"}
                onClick={() => router.push(item.href)}
                className="flex items-center gap-2"
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Button>
            ))}
          </nav>

          {/* Right side items */}
          <div className="flex items-center space-x-4">
            {user?.email && (
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
            )}
            <Button
              variant="ghost"
              onClick={handleLogout}
            >
              Logout
            </Button>
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
} 
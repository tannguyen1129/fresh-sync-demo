'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/common/Logo'; // Import logo vừa tạo
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { name: 'Solutions', href: '/#solutions' },
  { name: 'Features', href: '/#features' },
  { name: 'Impact', href: '/#impact' },
  { name: 'Contact', href: '/#contact' },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const pathname = usePathname();

  // Hiệu ứng đổi màu khi cuộn trang
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Ẩn Navbar trên các trang Dashboard (vì Dashboard có Header riêng)
  if (pathname.includes('/dashboard') || pathname.includes('/operator') || pathname.includes('/driver')) {
    return null; 
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        isScrolled 
          ? "bg-background/80 backdrop-blur-md border-border py-3 shadow-sm" 
          : "bg-transparent border-transparent py-5"
      )}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* 1. Logo */}
        <Logo />

        {/* 2. Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary hover:underline underline-offset-4"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* 3. Actions (Theme + Login) */}
        <div className="hidden md:flex items-center gap-4">
          <ThemeToggle />
          <div className="h-6 w-px bg-border" /> {/* Divider */}
          <Link href="/login">
            <Button variant="ghost" className="font-medium">Sign In</Button>
          </Link>
          <Link href="/login">
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* 4. Mobile Menu (Hamburger) */}
        <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                    <div className="flex flex-col gap-8 mt-8">
                        <Logo />
                        <nav className="flex flex-col gap-4">
                            {navItems.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className="text-lg font-medium hover:text-blue-600 transition-colors"
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </nav>
                        <div className="flex flex-col gap-4 mt-auto">
                            <Link href="/login" className="w-full">
                                <Button className="w-full" variant="outline">Sign In</Button>
                            </Link>
                            <Link href="/login" className="w-full">
                                <Button className="w-full bg-blue-600 hover:bg-blue-700">Get Started</Button>
                            </Link>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
      </div>
    </header>
  );
}
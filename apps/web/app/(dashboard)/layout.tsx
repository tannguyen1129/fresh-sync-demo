'use client';

import { useState } from 'react';
import { Sidebar } from "@/components/layout/Sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Logo } from "@/components/common/Logo";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100/80 dark:bg-slate-950">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:flex">
        <Sidebar />
      </div>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-4 backdrop-blur lg:hidden">
          <Logo size="sm" showText={true} />
          
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-r-0 bg-transparent p-0 shadow-none">
              <Sidebar />
            </SheetContent>
          </Sheet>
        </div>

        <main className="flex-1 px-4 py-4 md:px-6 md:py-6 xl:px-8">
          <div className="mx-auto max-w-[1600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

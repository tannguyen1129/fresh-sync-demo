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
    <div className="flex h-screen bg-background">
      {/* --- DESKTOP SIDEBAR (Ẩn trên Mobile) --- */}
      <div className="hidden md:flex h-full w-64 flex-col fixed inset-y-0 z-50">
        <Sidebar />
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col md:pl-64 h-full">
        
        {/* --- MOBILE HEADER (Chỉ hiện trên Mobile) --- */}
        <div className="md:hidden flex items-center justify-between p-4 border-b bg-background z-40">
          <Logo size="sm" showText={true} />
          
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0 bg-transparent shadow-none">
              {/* Tái sử dụng Sidebar component cho Mobile */}
              <Sidebar />
            </SheetContent>
          </Sheet>
        </div>

        {/* --- PAGE CONTENT --- */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
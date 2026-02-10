"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebarItems } from "./SidebarItems";
import { APP_NAME } from "@freshsync/shared";

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const items = useSidebarItems();

  return (
    <div className={cn("pb-12 bg-card border-r h-full", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-primary flex items-center gap-2">
            <div className="h-6 w-6 bg-primary rounded-md"></div>
            {APP_NAME}
          </h2>
          <div className="space-y-1">
            <ScrollArea className="h-[calc(100vh-100px)] px-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  variant={pathname.startsWith(item.href) ? "secondary" : "ghost"}
                  className={cn("w-full justify-start", pathname.startsWith(item.href) && "bg-secondary/50 font-medium")}
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
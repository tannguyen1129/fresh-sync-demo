'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext'; // [cite: 31]
import { usePathname } from 'next/navigation'; // [cite: 31]
import { Logo } from '@/components/common/Logo'; // Import Logo mới
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Truck, 
  Anchor, 
  FileText, 
  LogOut, 
  AlertTriangle, 
  PlusCircle,
  Zap,
  HandMetal,
  Settings,
  User
} from 'lucide-react';

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Logic phân quyền giữ nguyên như cũ [cite: 31]
  const getLinks = () => {
    switch (user?.role) {
      case 'PORT_OPERATOR':
        return [
          { href: '/operator/dashboard', label: 'Overview', icon: LayoutDashboard },
          { href: '/operator/capacity', label: 'Capacity Manager', icon: Anchor },
          { href: '/operator/incidents', label: 'Incidents', icon: AlertTriangle },
          { href: '/operator/override', label: 'Manual Override', icon: HandMetal }, 
          { href: '/operator/playground', label: 'Simulations', icon: Zap }, 
        ];
      case 'LOGISTICS_COORDINATOR':
        return [
          { href: '/business/dashboard', label: 'My Requests', icon: LayoutDashboard },
          { href: '/business/bookings', label: 'Bookings', icon: FileText },
          { href: '/business/pickup', label: 'New Request', icon: PlusCircle },
          { href: '/business/fleet', label: 'Fleet & Drivers', icon: Truck },
        ];
      case 'TRUCK_DRIVER':
        return [
          { href: '/driver/dashboard', label: 'My Assignments', icon: Truck },
          { href: '/driver/return-empty', label: 'Return Empty', icon: Anchor }, // Thêm cho Use Case 1B
        ];
      case 'PORT_AUTHORITY':
        return [
          { href: '/authority/dashboard', label: 'ESG Reports', icon: FileText },
        ];
      default:
        return [];
    }
  };

  const links = getLinks();

  return (
    <div className="flex h-screen w-64 flex-col bg-slate-950 text-white border-r border-slate-800">
      {/* 1. Header Area với Logo Mới */}
      <div className="flex h-16 items-center px-6 border-b border-slate-800 bg-slate-950">
        {/* Truyền className text-white để ghi đè màu chữ mặc định của Logo 
            vì Sidebar luôn là nền tối bất kể Light/Dark mode 
        */}
        <div className="[&_span]:text-white">
          <Logo size="md" />
        </div>
      </div>
      
      {/* 2. Navigation Area */}
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-1 px-3">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Menu
          </p>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className={cn("mr-3 h-5 w-5 transition-colors", isActive ? "text-white" : "text-slate-500 group-hover:text-white")} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 3. User Profile Footer */}
      <div className="border-t border-slate-800 p-4 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold shadow-sm">
                {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="text-sm font-medium text-white truncate">
                {user?.name}
                </div>
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider truncate">
                    {user?.role?.replace('_', ' ')}
                </div>
            </div>
        </div>
        
        <button
          onClick={logout}
          className="flex w-full items-center justify-center rounded-md border border-slate-700 bg-transparent px-4 py-2 text-sm text-slate-300 hover:bg-red-950 hover:text-red-400 hover:border-red-900 transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
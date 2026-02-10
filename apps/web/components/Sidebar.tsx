'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Truck, 
  Anchor, 
  FileText, 
  LogOut, 
  AlertTriangle, 
  PlusCircle,
  Zap,
  HandMetal
} from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const getLinks = () => {
    switch (user?.role) {
      case 'PORT_OPERATOR':
        return [
          { href: '/operator/dashboard', label: 'Overview', icon: LayoutDashboard },
          { href: '/operator/capacity', label: 'Capacity Manager', icon: Anchor },
          { href: '/operator/incidents', label: 'Incidents', icon: AlertTriangle },
          { href: '/operator/override', label: 'Manual Override', icon: HandMetal }, // Hoặc icon Stop/Block
          { href: '/operator/playground', label: 'Simulations', icon: Zap }, // Integration Playground
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
    <div className="flex h-screen w-64 flex-col bg-slate-900 text-white">
      <div className="flex h-16 items-center justify-center border-b border-slate-700 text-xl font-bold">
        FreshSync
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="mr-3 h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-700 p-4">
        <div className="mb-2 text-sm font-medium text-slate-400">
          {user?.name}
        </div>
        <div className="text-xs text-slate-500 mb-4 uppercase">{user?.role?.replace('_', ' ')}</div>
        <button
          onClick={logout}
          className="flex w-full items-center rounded-md px-4 py-2 text-sm text-slate-300 hover:bg-red-900 hover:text-white"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
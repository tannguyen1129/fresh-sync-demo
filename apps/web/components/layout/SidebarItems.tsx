import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Truck, Anchor, FileText, AlertTriangle, Zap, HandMetal, PlusCircle } from 'lucide-react';

export const useSidebarItems = () => {
  const { user } = useAuth();

  switch (user?.role) {
    case 'PORT_OPERATOR':
      return [
        { href: '/operator/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/operator/incidents', label: 'Incidents', icon: AlertTriangle },
        { href: '/operator/capacity', label: 'Capacity', icon: Anchor },
        { href: '/operator/override', label: 'Overrides', icon: HandMetal },
        { href: '/operator/playground', label: 'Simulations', icon: Zap },
      ];
    case 'LOGISTICS_COORDINATOR':
      return [
        { href: '/business/bookings', label: 'Bookings', icon: FileText },
        { href: '/business/pickup', label: 'New Request', icon: PlusCircle },
        { href: '/business/dashboard', label: 'Fleet', icon: Truck },
      ];
    case 'TRUCK_DRIVER':
      return [
        { href: '/driver/dashboard', label: 'Assignments', icon: Truck },
      ];
    case 'PORT_AUTHORITY':
      return [
        { href: '/authority/dashboard', label: 'ESG Reports', icon: FileText },
      ];
    default:
      return [];
  }
};
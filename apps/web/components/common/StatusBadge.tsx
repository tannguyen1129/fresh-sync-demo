import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Map colors to statuses
const statusMap: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  // Booking Statuses
  CONFIRMED: "success",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  BLOCKED: "destructive",
  RESCHEDULED: "warning",
  
  // Request Statuses
  CREATED: "outline",
  RECOMMENDED: "default",
  
  // Assignment Statuses
  NEW: "outline",
  ENROUTE: "default",
  ARRIVED_GATE: "warning",
  PICKED_UP: "default",
  DELIVERED: "success",
  RETURNED: "secondary"
};

// Custom badge styles extended from Shadcn
const badgeStyles = {
  success: "border-transparent bg-green-500 text-white hover:bg-green-600",
  warning: "border-transparent bg-yellow-500 text-white hover:bg-yellow-600",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variantKey = statusMap[status] || "outline";
  
  // If it's a custom variant key not in shadcn types
  if (variantKey === 'success' || variantKey === 'warning') {
      return (
          <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", badgeStyles[variantKey], className)}>
              {status.replace(/_/g, ' ')}
          </div>
      )
  }

  return (
    <Badge variant={variantKey as any} className={className}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
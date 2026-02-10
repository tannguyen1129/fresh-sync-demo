'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS, BookingUpdatedPayload } from '@freshsync/shared';
import { toast } from 'sonner';
import { 
  Navigation, 
  MapPin, 
  AlertTriangle, 
  ChevronRight,
  Box,
  Truck,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// State Machine for UI
const STATUS_CONFIG: any = {
  'NEW': { label: 'START TRIP', next: 'ENROUTE', color: 'bg-blue-600 hover:bg-blue-700' },
  'ENROUTE': { label: 'ARRIVED AT GATE', next: 'ARRIVED_GATE', color: 'bg-orange-600 hover:bg-orange-700' },
  'ARRIVED_GATE': { label: 'CONFIRM PICKUP', next: 'PICKED_UP', color: 'bg-indigo-600 hover:bg-indigo-700' },
  'PICKED_UP': { label: 'DEPART PORT', next: 'DEPARTED', color: 'bg-purple-600 hover:bg-purple-700' },
  'DEPARTED': { label: 'ARRIVED DESTINATION', next: 'DELIVERED', color: 'bg-green-600 hover:bg-green-700' },
  'DELIVERED': { label: 'RETURN EMPTY', next: 'RETURN_FLOW', color: 'bg-zinc-800 hover:bg-zinc-900' },
};

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { socket } = useSocket();
  
  const [assignment, setAssignment] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const { data } = await api.get('/driver/assignments');
        const found = data.find((a: any) => a.id === id);
        setAssignment(found);
      } catch (e) { toast.error("Failed to load job"); }
    };
    fetchDetail();
  }, [id]);

  // Realtime Alert Listener
  useEffect(() => {
    if (!socket || !assignment) return;
    socket.on(EVENTS.BOOKING_UPDATED, (payload: BookingUpdatedPayload) => {
        if (payload.bookingId === assignment.bookingId) {
            if (payload.newStatus === 'RESCHEDULED') {
                setAlert("Schedule Updated by Ops Center due to congestion.");
                toast.warning("Job Rescheduled!");
            }
            // Update local state if needed
        }
    });
    return () => { socket.off(EVENTS.BOOKING_UPDATED); };
  }, [socket, assignment]);

  const handleAction = async () => {
    if (!assignment) return;
    const config = STATUS_CONFIG[assignment.status];
    
    // Redirect to Return Empty Flow
    if (config.next === 'RETURN_FLOW') {
        router.push(`/driver/return-empty?assignmentId=${assignment.id}`);
        return;
    }

    setUpdating(true);
    try {
        await api.post(`/driver/assignments/${id}/status`, {
            status: config.next,
            lat: 10.7, lng: 106.6 // Mock GPS
        });
        setAssignment({...assignment, status: config.next});
        toast.success("Status Updated");
    } catch (e) {
        toast.error("Update failed");
    } finally {
        setUpdating(false);
    }
  };

  if (!assignment) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/></div>;

  const currentConfig = STATUS_CONFIG[assignment.status];
  const container = assignment.booking.request.container;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* 1. Map Placeholder Area */}
      <div className="h-[35vh] bg-slate-100 relative w-full overflow-hidden border-b">
         <div className="absolute inset-0 flex items-center justify-center text-slate-300">
             <MapPin className="w-16 h-16 opacity-20" />
         </div>
         {/* Live Status Overlay */}
         <div className="absolute top-4 left-4">
             <Badge className="bg-background/80 text-foreground backdrop-blur-md shadow-sm">
                Job #{assignment.id.slice(0,6)}
             </Badge>
         </div>
      </div>

      {/* 2. Content Body */}
      <div className="flex-1 px-5 py-6 space-y-6">
         {/* Disruption Alert */}
         {(alert || assignment.booking.status === 'RESCHEDULED') && (
            <Alert variant="destructive" className="border-red-500 bg-red-50 text-red-700 shadow-md animate-in slide-in-from-top-2">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-bold ml-2">Route Changed!</AlertTitle>
                <AlertDescription className="ml-2">
                    {alert || "Your slot has been rescheduled due to port congestion."}
                </AlertDescription>
            </Alert>
         )}

         {/* Container Info */}
         <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-foreground">{container.containerNo}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
                <Box className="w-4 h-4" />
                <span>{container.sizeType}</span>
                <span>•</span>
                <span>{container.isReefer ? '❄️ Reefer' : 'Dry Cargo'}</span>
            </div>
         </div>

         {/* Steps / Route */}
         <div className="space-y-4 pt-4">
             <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Route Plan</h3>
             <div className="relative pl-4 ml-1.5 border-l-2 border-slate-200 space-y-6">
                <div className="relative">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background"></span>
                    <p className="font-medium text-foreground">Port Gate 1</p>
                    <p className="text-xs text-muted-foreground">Pickup Location</p>
                </div>
                <div className="relative">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-slate-300 ring-4 ring-background"></span>
                    <p className="font-medium text-foreground">Logistics Warehouse D9</p>
                    <p className="text-xs text-muted-foreground">Delivery Location</p>
                </div>
             </div>
         </div>
      </div>

      {/* 3. Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t z-50">
         {currentConfig ? (
             <Button 
                onClick={handleAction} 
                disabled={updating}
                className={cn("w-full h-14 text-lg font-bold shadow-xl transition-all active:scale-[0.98]", currentConfig.color)}
             >
                {updating ? <Loader2 className="animate-spin mr-2" /> : <Navigation className="mr-2 h-6 w-6" />}
                {currentConfig.label}
             </Button>
         ) : (
            <div className="h-14 flex items-center justify-center text-green-600 font-bold bg-green-50 rounded-md border border-green-200">
                <CheckCircle className="mr-2 h-6 w-6" /> Completed
            </div>
         )}
      </div>
    </div>
  );
}
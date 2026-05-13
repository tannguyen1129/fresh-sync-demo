'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS, BookingUpdatedPayload, DriverAssignmentPayload } from '@freshsync/shared';
import { toast } from 'sonner';
import {
  Navigation,
  AlertTriangle,
  Box,
  CheckCircle,
  Loader2,
  Clock3,
  Route,
  TimerReset,
  QrCode,
  ScanLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const DriverJobMap = dynamic(
  () => import('@/components/maps/DriverJobMap').then((mod) => mod.DriverJobMap),
  { ssr: false, loading: () => <Skeleton className="h-[35vh] w-full rounded-none" /> },
);

// State Machine for UI
const STATUS_CONFIG: any = {
  'NEW': { label: 'START TRIP', next: 'ENROUTE', color: 'bg-blue-600 hover:bg-blue-700' },
  'ENROUTE': { label: 'ARRIVED AT GATE', next: 'ARRIVED_GATE', color: 'bg-orange-600 hover:bg-orange-700' },
  'ARRIVED_GATE': { label: 'CONFIRM PICKUP', next: 'PICKED_UP', color: 'bg-indigo-600 hover:bg-indigo-700' },
  'PICKED_UP': { label: 'DEPART PORT', next: 'DEPARTED', color: 'bg-purple-600 hover:bg-purple-700' },
  'DEPARTED': { label: 'ARRIVED DESTINATION', next: 'DELIVERED', color: 'bg-green-600 hover:bg-green-700' },
  'DELIVERED': { label: 'RETURN EMPTY', next: 'RETURN_FLOW', color: 'bg-zinc-800 hover:bg-zinc-900' },
};

const RETURN_STATUS_CONFIG: any = {
  'NEW': { label: 'START RETURN', next: 'RETURN_EMPTY_STARTED', color: 'bg-emerald-600 hover:bg-emerald-700' },
  'RETURN_EMPTY_STARTED': { label: 'CONFIRM RETURNED', next: 'RETURNED', color: 'bg-green-700 hover:bg-green-800' },
};

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { socket } = useSocket();
  
  const [assignment, setAssignment] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
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
    socket.on(EVENTS.DRIVER_ASSIGNMENT_UPDATED, (payload: DriverAssignmentPayload) => {
      if (payload.assignmentId === assignment.id) {
        setAssignment((prev: any) => prev ? { ...prev, status: payload.status, updatedAt: payload.updatedAt } : prev);
      }
    });
    return () => {
      socket.off(EVENTS.BOOKING_UPDATED);
      socket.off(EVENTS.DRIVER_ASSIGNMENT_UPDATED);
    };
  }, [socket, assignment]);

  const handleAction = async () => {
    if (!assignment) return;
    const config = assignment.type === 'RETURN_EMPTY'
      ? RETURN_STATUS_CONFIG[assignment.status]
      : STATUS_CONFIG[assignment.status];
    
    // Redirect to Return Empty Flow
    if (config.next === 'RETURN_FLOW') {
        router.push(`/driver/return-empty?assignmentId=${assignment.id}`);
        return;
    }

    setUpdating(true);
    try {
        const { data } = await api.post(`/driver/assignments/${id}/status`, {
            status: config.next,
            lat: 10.7, lng: 106.6 // Mock GPS
        });
        setAssignment(data);
        toast.success("Status Updated");
    } catch (e) {
        toast.error("Update failed");
    } finally {
        setUpdating(false);
    }
  };

  const handleCheckIn = async () => {
    if (!assignment?.booking?.qrToken) {
      toast.error('QR token is not ready for this booking');
      return;
    }
    setCheckingIn(true);
    try {
      const { data } = await api.post(`/driver/bookings/${assignment.booking.id}/check-in`, {
        qrToken: assignment.booking.qrToken,
        lat: 10.77,
        lng: 106.79,
      });
      setAssignment((prev: any) => prev ? {
        ...prev,
        status: data.assignment.status,
        booking: {
          ...prev.booking,
          checkInStatus: data.booking.checkInStatus,
          checkInAt: data.booking.checkInAt,
        },
      } : prev);
      toast.success('QR check-in completed');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  if (!assignment) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/></div>;

  const currentConfig = assignment.type === 'RETURN_EMPTY'
    ? RETURN_STATUS_CONFIG[assignment.status]
    : STATUS_CONFIG[assignment.status];
  const container = assignment.booking.request.container;
  const routeTitle = assignment.type === 'RETURN_EMPTY'
    ? assignment.routeJson?.destination || 'Assigned depot'
    : 'Port Gate 1';
  const routeSubtitle = assignment.type === 'RETURN_EMPTY'
    ? assignment.routeJson?.distance || 'Empty return destination'
    : 'Pickup Location';
  const finalTitle = assignment.type === 'RETURN_EMPTY'
    ? 'Depot Check-in'
    : 'Logistics Warehouse D9';
  const finalSubtitle = assignment.type === 'RETURN_EMPTY'
    ? 'Complete empty return'
    : 'Delivery Location';
  const jitTone = assignment.type === 'RETURN_EMPTY' ? null : getJitTone(assignment.routeJson?.suggestedArrivalTime, assignment.booking.confirmedSlotStart);
  const jitText = assignment.type === 'RETURN_EMPTY'
    ? `${assignment.routeJson?.trafficLevel || 'LOW'} traffic • est. ${assignment.routeJson?.estimatedMinutes || 15} min`
    : getJitText(jitTone, assignment.routeJson?.suggestedArrivalTime, assignment.booking.confirmedSlotStart);
  const timeline = assignment.type === 'RETURN_EMPTY'
    ? [
        { label: 'Assignment created', done: true, time: assignment.updatedAt },
        { label: 'Start return', done: ['RETURN_EMPTY_STARTED', 'RETURNED'].includes(assignment.status), time: assignment.status === 'RETURNED' || assignment.status === 'RETURN_EMPTY_STARTED' ? assignment.updatedAt : null },
        { label: 'Returned empty', done: assignment.status === 'RETURNED', time: assignment.status === 'RETURNED' ? assignment.updatedAt : null },
      ]
    : [
        { label: 'En route', done: ['ENROUTE', 'ARRIVED_GATE', 'PICKED_UP', 'DEPARTED', 'DELIVERED'].includes(assignment.status), time: assignment.status !== 'NEW' ? assignment.updatedAt : null },
        { label: 'Arrived gate', done: ['ARRIVED_GATE', 'PICKED_UP', 'DEPARTED', 'DELIVERED'].includes(assignment.status), time: assignment.actualIn },
        { label: 'Picked up', done: ['PICKED_UP', 'DEPARTED', 'DELIVERED'].includes(assignment.status), time: ['PICKED_UP', 'DEPARTED', 'DELIVERED'].includes(assignment.status) ? assignment.updatedAt : null },
        { label: 'Departed port', done: ['DEPARTED', 'DELIVERED'].includes(assignment.status), time: assignment.actualOut },
        { label: 'Delivered', done: assignment.status === 'DELIVERED', time: assignment.status === 'DELIVERED' ? assignment.updatedAt : null },
      ];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* 1. Real Leaflet map for JIT route */}
      <div className="h-[35vh] relative w-full overflow-hidden border-b">
         <DriverJobMap
           driverLat={assignment.driver?.currentLat}
           driverLng={assignment.driver?.currentLng}
           driverName={assignment.driver?.name || 'Assigned truck'}
           containerNo={container.containerNo}
           routeJson={assignment.routeJson}
           type={assignment.type}
           destinationLabel={assignment.type === 'RETURN_EMPTY' ? (assignment.routeJson?.destination || 'Assigned depot') : undefined}
           destinationLat={assignment.routeJson?.depotLat}
           destinationLng={assignment.routeJson?.depotLng}
           height="100%"
         />
         <div className="pointer-events-none absolute left-4 top-4 z-[400] flex flex-col gap-2">
             <Badge className="bg-background/80 text-foreground backdrop-blur-md shadow-sm">
                Job #{assignment.id.slice(0,6)}
             </Badge>
             <Badge variant="outline" className="bg-background/80 backdrop-blur-md shadow-sm">
                {assignment.type.replace('_', ' ')}
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

         <div className={cn("rounded-xl border p-4", jitTone === 'early' && 'border-yellow-200 bg-yellow-50', jitTone === 'late' && 'border-red-200 bg-red-50', jitTone === 'ontime' && 'border-green-200 bg-green-50', assignment.type === 'RETURN_EMPTY' && 'border-sky-200 bg-sky-50')}>
            <div className="flex items-center gap-3">
              <TimerReset className={cn("h-5 w-5", jitTone === 'early' && 'text-yellow-700', jitTone === 'late' && 'text-red-600', jitTone === 'ontime' && 'text-green-600', assignment.type === 'RETURN_EMPTY' && 'text-sky-600')} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{assignment.type === 'RETURN_EMPTY' ? 'Return Guidance' : 'JIT Guidance'}</p>
                <p className="text-sm font-medium">{jitText}</p>
              </div>
            </div>
         </div>

         {assignment.type !== 'RETURN_EMPTY' && (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">QR Check-in</p>
                <p className="mt-1 text-lg font-bold">{assignment.booking.bookingCode}</p>
                <p className="text-sm text-muted-foreground">Token: {assignment.booking.qrToken}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Status: {assignment.booking.checkInStatus || 'PENDING'}
                  {assignment.booking.checkInAt ? ` • ${new Date(assignment.booking.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-xl border bg-slate-50 p-3 text-slate-700">
                  <QrCode className="h-10 w-10" />
                </div>
                <Button variant="outline" size="sm" onClick={handleCheckIn} disabled={checkingIn || assignment.booking.checkInStatus === 'CHECKED_IN'}>
                  {checkingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                  {assignment.booking.checkInStatus === 'CHECKED_IN' ? 'Checked In' : 'Simulate Scan'}
                </Button>
              </div>
            </div>
          </div>
         )}

         <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase font-semibold"><Clock3 className="h-4 w-4" /> Slot Window</div>
              <p className="mt-2 text-sm font-medium">{new Date(assignment.booking.confirmedSlotStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(assignment.booking.confirmedSlotEnd).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase font-semibold"><Route className="h-4 w-4" /> ETA</div>
              <p className="mt-2 text-sm font-medium">{assignment.routeJson?.etaToGateMinutes ? `${assignment.routeJson.etaToGateMinutes} min to gate` : `${assignment.routeJson?.estimatedMinutes || 15} min remaining`}</p>
            </div>
         </div>

         {/* Steps / Route */}
         <div className="space-y-4 pt-4">
             <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Route Plan</h3>
             <div className="relative pl-4 ml-1.5 border-l-2 border-slate-200 space-y-6">
                <div className="relative">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background"></span>
                    <p className="font-medium text-foreground">{routeTitle}</p>
                    <p className="text-xs text-muted-foreground">{routeSubtitle}</p>
                </div>
                <div className="relative">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-slate-300 ring-4 ring-background"></span>
                    <p className="font-medium text-foreground">{finalTitle}</p>
                    <p className="text-xs text-muted-foreground">{finalSubtitle}</p>
                </div>
             </div>
         </div>

         <div className="space-y-4 pt-4">
           <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status Timeline</h3>
           <div className="space-y-3">
             {timeline.map((item, index) => (
               <div key={`${item.label}-${index}`} className="flex items-start gap-3 rounded-lg border p-3">
                 <div className={cn("mt-0.5 h-3 w-3 rounded-full", item.done ? "bg-green-500" : "bg-slate-300")} />
                 <div>
                   <p className="text-sm font-medium">{item.label}</p>
                   <p className="text-xs text-muted-foreground">{item.time ? new Date(item.time).toLocaleString() : 'Waiting for next update'}</p>
                 </div>
               </div>
             ))}
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

function getJitTone(suggestedArrivalTime?: string, slotStart?: string) {
  if (!suggestedArrivalTime || !slotStart) return 'ontime';
  const now = new Date().getTime();
  const suggested = new Date(suggestedArrivalTime).getTime();
  const slot = new Date(slotStart).getTime();
  if (now < suggested) return 'early';
  if (now > slot) return 'late';
  return 'ontime';
}

function getJitText(tone: string | null, suggestedArrivalTime?: string, slotStart?: string) {
  if (!suggestedArrivalTime || !slotStart) return 'JIT timing unavailable';
  if (tone === 'early') return `Too early. Hold staging until ${new Date(suggestedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
  if (tone === 'late') return `Late. Slot started at ${new Date(slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Proceed directly to gate.`;
  return `On time. Enter before ${new Date(slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
}

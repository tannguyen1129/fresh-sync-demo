'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS, DriverAssignmentPayload } from '@freshsync/shared';
import { MapPin, Clock, Truck, ArrowRight, CheckCircle2, TimerReset, QrCode, ShieldCheck, Waves, BrainCircuit, Map as MapIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PageContainer } from '@/components/common/PageContainer';
import { cn } from '@/lib/utils';

const DriverJobMap = dynamic(
  () => import('@/components/maps/DriverJobMap').then((mod) => mod.DriverJobMap),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full rounded-xl" /> },
);

export default function DriverDashboard() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const { data } = await api.get('/driver/assignments');
        setAssignments(data);
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refreshAssignments = async (_payload: DriverAssignmentPayload) => {
      try {
        const { data } = await api.get('/driver/assignments');
        setAssignments(data);
      } catch (e) {
        console.error(e);
      }
    };

    socket.on(EVENTS.DRIVER_ASSIGNMENT_CREATED, refreshAssignments);
    socket.on(EVENTS.DRIVER_ASSIGNMENT_UPDATED, refreshAssignments);

    return () => {
      socket.off(EVENTS.DRIVER_ASSIGNMENT_CREATED, refreshAssignments);
      socket.off(EVENTS.DRIVER_ASSIGNMENT_UPDATED, refreshAssignments);
    };
  }, [socket]);

  return (
    <PageContainer className="max-w-md mx-auto pb-20">
      <PageHeader
        title="Driver Today Tasks"
        subtitle="Route, slot, gate, and QR guidance for just-in-time arrival."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/driver/qr">
              <QrCode className="mr-2 h-4 w-4" />
              QR Check-in
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4">
        <Card className="overflow-hidden border bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_40%,_#f8fafc_85%)]">
          <CardContent className="grid gap-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Driver Story</div>
                <h2 className="mt-2 text-xl font-black tracking-tight">No algorithm complexity on the driver side</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Driver only sees the next task, target arrival, route cue, and QR validation package.
                </p>
              </div>
              <Waves className="h-8 w-8 text-primary" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Active Jobs" value={assignments.filter((assignment) => !['DELIVERED', 'RETURNED'].includes(assignment.status)).length} />
              <MetricCard label="QR Ready" value={assignments.filter((assignment) => assignment.booking?.qrToken).length} />
              <MetricCard label="At Gate" value={assignments.filter((assignment) => assignment.booking?.checkInStatus === 'CHECKED_IN').length} />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                AI Dispatch Layer
              </div>
              <div className="mt-2 text-lg font-bold">JIT guidance keeps drivers out of blind queueing</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Arrival timing, gate choice, and QR readiness come from the orchestration engine. Driver screens stay simple, but the coordination behind them is live.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Pickup Tasks" value={assignments.filter((assignment) => assignment.type === 'PICKUP').length} />
              <MetricCard label="Return Flows" value={assignments.filter((assignment) => assignment.type === 'RETURN_EMPTY').length} />
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>}

      {!loading && assignments.length === 0 && (
        <div className="text-center p-10 flex flex-col items-center justify-center bg-muted/20 rounded-xl border-dashed border-2">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-semibold">No active jobs</h3><p className="text-muted-foreground">You are all clear for now.</p>
        </div>
      )}

      {!loading && assignments[0] ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b bg-slate-50/80 px-4 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <MapIcon className="h-3.5 w-3.5" /> Next Move Map
            </div>
            <Badge variant="outline" className="text-[10px]">{assignments[0].booking.request.container.containerNo}</Badge>
          </div>
          <DriverJobMap
            driverLat={assignments[0].driver?.currentLat}
            driverLng={assignments[0].driver?.currentLng}
            driverName={assignments[0].driver?.name}
            containerNo={assignments[0].booking.request.container.containerNo}
            routeJson={assignments[0].routeJson}
            type={assignments[0].type}
            destinationLabel={assignments[0].type === 'RETURN_EMPTY' ? (assignments[0].routeJson?.destination || 'Depot') : undefined}
            destinationLat={assignments[0].routeJson?.depotLat}
            destinationLng={assignments[0].routeJson?.depotLng}
            height={220}
          />
        </Card>
      ) : null}

      {assignments.map((assignment) => {
        const container = assignment.booking.request.container;
        const isActive = ['NEW', 'ENROUTE', 'ARRIVED_GATE', 'PICKED_UP', 'RETURN_EMPTY_STARTED'].includes(assignment.status);
        const isCompleted = ['DELIVERED', 'RETURNED'].includes(assignment.status);
        const destination =
          assignment.type === 'RETURN_EMPTY'
            ? assignment.routeJson?.destination || 'Assigned depot'
            : assignment.routeJson?.steps?.[1] || 'Port Zone B';
        const slotLabel =
          assignment.type === 'RETURN_EMPTY'
            ? assignment.routeJson?.distance || 'Depot transfer'
            : new Date(assignment.booking.confirmedSlotStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const jitTone =
          assignment.type === 'RETURN_EMPTY'
            ? null
            : getJitTone(assignment.routeJson?.suggestedArrivalTime, assignment.booking.confirmedSlotStart);
        const jitText =
          assignment.type === 'RETURN_EMPTY'
            ? assignment.routeJson?.trafficLevel || 'Return flow'
            : getJitText(jitTone, assignment.routeJson?.suggestedArrivalTime, assignment.booking.confirmedSlotStart);

        return (
          <Link key={assignment.id} href={`/driver/assignments/${assignment.id}`}>
            <Card className={cn("overflow-hidden transition-all active:scale-[0.98]", isActive ? "border-primary/50 shadow-md ring-1 ring-primary/20" : "opacity-80 bg-muted/30")}>
              {isActive && <div className="bg-primary px-4 py-1 text-xs font-bold text-primary-foreground flex justify-between items-center"><span>CURRENT TASK</span><span className="animate-pulse">● Live</span></div>}
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{assignment.type.replace('_', ' ')}</Badge>
                            <span className="text-xs text-muted-foreground font-mono">{new Date(assignment.updatedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight">{container.containerNo}</h3>
                        <p className="text-sm text-muted-foreground">{container.sizeType}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{assignment.booking.bookingCode || 'Pending booking code'}</p>
                    </div>
                    <StatusBadge status={assignment.status} className="scale-110 origin-top-right" />
                </div>
                <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" /><div><p className="text-xs text-muted-foreground uppercase font-semibold">Destination</p><p className="text-sm font-medium leading-tight mt-0.5">{destination}</p></div></div>
                    <div className="flex items-start gap-3"><Clock className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" /><div><p className="text-xs text-muted-foreground uppercase font-semibold">{assignment.type === 'RETURN_EMPTY' ? 'Trip Distance' : 'Slot Time'}</p><p className="text-sm font-medium leading-tight mt-0.5">{slotLabel}</p></div></div>
                    <div className="flex items-start gap-3"><TimerReset className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" /><div><p className="text-xs text-muted-foreground uppercase font-semibold">{assignment.type === 'RETURN_EMPTY' ? 'Traffic' : 'JIT Guidance'}</p><p className={cn("text-sm font-medium leading-tight mt-0.5", jitTone === 'early' && 'text-yellow-700', jitTone === 'late' && 'text-red-600', jitTone === 'ontime' && 'text-green-600')}>{jitText}</p></div></div>
                    {assignment.type !== 'RETURN_EMPTY' && (
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold">Gate & QR</p>
                          <p className="text-sm font-medium leading-tight mt-0.5">{assignment.booking.terminalCode || 'TML-A'} • {assignment.booking.assignedGate || 'Gate TBD'}</p>
                          <div className="mt-2">
                            <StatusBadge status={assignment.booking.checkInStatus || 'PENDING'} />
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </CardContent>
              <div className="bg-muted/50 p-3 flex justify-center border-t">
                 {isCompleted ? <span className="flex items-center text-sm font-medium text-green-600"><CheckCircle2 className="w-4 h-4 mr-2" /> Completed</span> : <span className="flex items-center text-sm font-bold text-primary">{isActive ? "Continue Job" : "Start Job"} <ArrowRight className="w-4 h-4 ml-2" /></span>}
              </div>
            </Card>
          </Link>
        );
      })}
    </PageContainer>
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
  if (tone === 'early') return `Too early. Target arrival ${new Date(suggestedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (tone === 'late') return `Late for slot starting ${new Date(slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return 'On time for slot window';
}

function MetricCard({ label, value }: any) {
  return (
    <div className="rounded-2xl border bg-white/80 p-3 text-center shadow-sm backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

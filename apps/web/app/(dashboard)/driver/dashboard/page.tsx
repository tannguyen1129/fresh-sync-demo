'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { MapPin, Clock, Truck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PageContainer } from '@/components/common/PageContainer'; // Import mới
import { cn } from '@/lib/utils';

export default function DriverDashboard() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <PageContainer className="max-w-md mx-auto pb-20">
      <PageHeader title="My Jobs" subtitle="Current and upcoming assignments." />

      {loading && <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>}

      {!loading && assignments.length === 0 && (
        <div className="text-center p-10 flex flex-col items-center justify-center bg-muted/20 rounded-xl border-dashed border-2">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-semibold">No active jobs</h3><p className="text-muted-foreground">You are all clear for now.</p>
        </div>
      )}

      {assignments.map((assignment) => {
        const container = assignment.booking.request.container;
        const isActive = ['NEW', 'ENROUTE', 'ARRIVED_GATE', 'PICKED_UP'].includes(assignment.status);
        const isCompleted = ['DELIVERED', 'RETURNED'].includes(assignment.status);

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
                        <h3 className="text-2xl font-bold tracking-tight">{container.containerNo}</h3><p className="text-sm text-muted-foreground">{container.sizeType}</p>
                    </div>
                    <StatusBadge status={assignment.status} className="scale-110 origin-top-right" />
                </div>
                <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" /><div><p className="text-xs text-muted-foreground uppercase font-semibold">Destination</p><p className="text-sm font-medium leading-tight mt-0.5">{assignment.routeJson?.steps?.[1] || 'Port Zone B'}</p></div></div>
                    <div className="flex items-start gap-3"><Clock className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" /><div><p className="text-xs text-muted-foreground uppercase font-semibold">Slot Time</p><p className="text-sm font-medium leading-tight mt-0.5">{new Date(assignment.booking.confirmedSlotStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p></div></div>
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
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, QrCode, ScanLine, ShieldCheck, Truck } from 'lucide-react';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DriverQrPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/driver/tasks/today');
        setTasks(data.filter((task: any) => task.type === 'PICKUP'));
      } catch (error) {
        toast.error('Failed to load QR tasks');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="QR Check-in"
        subtitle="Driver-facing booking QR, slot window, and gate validation package."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardHeader className="bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_45%,_#f8fafc_85%)]">
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Gate Validation Story
            </CardTitle>
            <CardDescription>
              This screen exists for the demo narrative: booking confirmed, QR ready, driver arrives, gate validates instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {loading ? (
              <>
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </>
            ) : tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No pickup QR is ready yet. Confirm a business booking first to generate a driver task.
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.assignmentId} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Booking Code</div>
                      <div className="mt-1 text-2xl font-black tracking-tight">{task.bookingCode}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{task.containerNo}</span>
                        <span>•</span>
                        <span>{task.terminalCode}</span>
                        <span>•</span>
                        <span>{task.gate}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <StatusBadge status={task.status} />
                      <StatusBadge status={task.checkInStatus || 'PENDING'} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-[160px_1fr]">
                    <div className="flex h-40 items-center justify-center rounded-2xl border bg-slate-50">
                      <QrCode className="h-20 w-20 text-slate-700" />
                    </div>
                    <div className="space-y-3">
                      <InfoRow icon={CalendarClock} label="Slot Window" value={`${new Date(task.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(task.slotEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
                      <InfoRow icon={Truck} label="Route Guidance" value={task.routeJson?.suggestedArrivalTime ? `Target arrival ${new Date(task.routeJson.suggestedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'JIT timing ready on task detail screen'} />
                      <InfoRow icon={ShieldCheck} label="Gate Validation" value={task.qrReady ? 'QR token is ready for scan at the port gate.' : 'QR token pending.'} />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href={`/driver/assignments/${task.assignmentId}`}>
                        <ScanLine className="mr-2 h-4 w-4" />
                        Open Task & Simulate Scan
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/driver/dashboard">Back to Today Tasks</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to Present It</CardTitle>
            <CardDescription>A clean script for the driver role during demo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border p-4">
              <div className="font-semibold">1. Show the assigned booking code</div>
              <div className="mt-1 text-muted-foreground">The code stays consistent across Business, Driver, and Operator views.</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="font-semibold">2. Emphasize JIT arrival</div>
              <div className="mt-1 text-muted-foreground">Driver follows the suggested slot and gate instead of guessing arrival time.</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="font-semibold">3. Simulate scan</div>
              <div className="mt-1 text-muted-foreground">Check-in updates booking state for both the business portal and control tower.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function InfoRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <div className="rounded-lg bg-slate-100 p-2">
        <Icon className="h-4 w-4 text-slate-700" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

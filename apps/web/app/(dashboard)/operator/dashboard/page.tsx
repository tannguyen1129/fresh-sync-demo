'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import {
  EVENTS,
  CongestionUpdatePayload,
  DisruptionCreatedPayload,
  DriverAssignmentPayload,
  NotificationPayload,
} from '@freshsync/shared';
import {
  Activity,
  Truck,
  AlertOctagon,
  Anchor,
  Search,
  Filter,
  Zap,
  SlidersHorizontal,
  HandMetal,
  MoreHorizontal,
  Map as MapIcon,
  Route,
  ShieldAlert,
  BrainCircuit,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PageContainer } from '@/components/common/PageContainer';
import { cn } from '@/lib/utils';

const PortMap = dynamic(
  () => import('@/components/maps/PortMap').then((mod) => mod.PortMap),
  { ssr: false, loading: () => <Skeleton className="h-[420px] w-full rounded-none" /> },
);

export default function OperatorDashboard() {
  const { socket } = useSocket();
  const [metrics, setMetrics] = useState<any>(null);
  const [impacted, setImpacted] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, impactedRes, snapshotRes] = await Promise.all([
        api.get('/operator/monitor/congestion'),
        api.get('/operator/monitor/impacted'),
        api.get('/meta/port-map-snapshot'),
      ]);
      setMetrics(metricsRes.data);
      setImpacted(impactedRes.data);
      setSnapshot(snapshotRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on(EVENTS.CONGESTION_UPDATED, (payload: CongestionUpdatePayload) => {
      setMetrics((prev: any) => ({
        ...prev,
        timestamp: payload.timestamp,
        metrics: {
          gateUtilization: payload.gateLoad,
          avgYardOccupancy: payload.yardOccupancy['ZONE_B'] || 50,
          activeDisruptions: payload.activeDisruptions,
        },
      }));
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLogs((prev) => [`[${time}] System updated: Gate load at ${payload.gateLoad}%`, ...prev.slice(0, 19)]);
    });
    socket.on(EVENTS.BOOKING_UPDATED, (payload: any) => {
      if (payload.newStatus === 'BLOCKED' || payload.newStatus === 'RESCHEDULED') {
        const time = new Date().toLocaleTimeString();
        setLogs((prev) => [`[${time}] ${payload.containerNo} marked as ${payload.newStatus}`, ...prev]);
        fetchData();
      }
    });
    socket.on(EVENTS.DISRUPTION_CREATED, (payload: DisruptionCreatedPayload) => {
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [
        `[${time}] Disruption ${payload.type} created for ${payload.affectedZones.join(', ')}`,
        ...prev.slice(0, 19),
      ]);
      fetchData();
    });
    socket.on(EVENTS.DRIVER_ASSIGNMENT_CREATED, (payload: DriverAssignmentPayload) => {
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [
        `[${time}] Driver ${payload.driverName || 'fleet'} received ${payload.type} for ${payload.containerNo}`,
        ...prev.slice(0, 19),
      ]);
    });
    socket.on(EVENTS.DRIVER_ASSIGNMENT_UPDATED, (payload: DriverAssignmentPayload) => {
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [
        `[${time}] Driver ${payload.driverName || 'fleet'} updated ${payload.containerNo} to ${payload.status}`,
        ...prev.slice(0, 19),
      ]);
    });
    socket.on(EVENTS.NOTIFICATION_CREATED, (payload: NotificationPayload) => {
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [`[${time}] Notification: ${payload.title}`, ...prev.slice(0, 19)]);
    });
    return () => {
      socket.off(EVENTS.CONGESTION_UPDATED);
      socket.off(EVENTS.BOOKING_UPDATED);
      socket.off(EVENTS.DISRUPTION_CREATED);
      socket.off(EVENTS.DRIVER_ASSIGNMENT_CREATED);
      socket.off(EVENTS.DRIVER_ASSIGNMENT_UPDATED);
      socket.off(EVENTS.NOTIFICATION_CREATED);
    };
  }, [socket]);

  const trucks = snapshot?.trucks ?? [];
  const gates = snapshot?.gates ?? [];
  const yards = snapshot?.yardStatuses ?? [];
  const depots = snapshot?.depots ?? [];
  const disruptions = snapshot?.disruptions ?? [];
  const terminals = snapshot?.terminals ?? [];
  const recentUtilization = snapshot?.recentUtilization ?? [];

  const chartData = useMemo(() => {
    if (recentUtilization.length === 0) {
      return [
        { time: '08:00', load: 45, peak: 0 },
        { time: '09:00', load: 60, peak: 0 },
        { time: '10:00', load: 85, peak: 1 },
        { time: '11:00', load: 70, peak: 0 },
        { time: '12:00', load: 50, peak: 0 },
        { time: '13:00', load: 65, peak: 0 },
      ];
    }
    return recentUtilization.map((point: any) => ({
      time: point.hour,
      load: point.utilizationPct,
      peak: point.isPeakHour ? 100 : 0,
    }));
  }, [recentUtilization]);

  const depotChartData = useMemo(
    () =>
      depots.map((depot: any) => ({
        name: depot.name.split('(')[0].trim(),
        load: depot.loadPct,
        fill: depot.status === 'FULL' ? '#dc2626' : depot.loadPct > 80 ? '#d97706' : '#16a34a',
      })),
    [depots],
  );

  const filteredImpacted = impacted.filter((item) => {
    const matchesSearch = item.request.container.containerNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <PageContainer>
      <PageHeader
        title="Control Tower"
        subtitle="Real-time port operations monitoring and intervention."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2 border-green-200 bg-green-50 px-3 py-1 text-green-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Live Connection
            </Badge>
            <Button size="sm" variant="outline" onClick={fetchData}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Gate Utilization" value={metrics?.metrics?.gateUtilization} unit="%" icon={Truck} loading={loading} trend={metrics?.metrics?.gateUtilization > 80 ? 'up' : 'down'} />
        <KpiCard title="Yard Occupancy" value={metrics?.metrics?.avgYardOccupancy} unit="%" icon={Anchor} loading={loading} />
        <KpiCard title="Active Disruptions" value={metrics?.metrics?.activeDisruptions} icon={AlertOctagon} loading={loading} alert={metrics?.metrics?.activeDisruptions > 0} />
        <KpiCard title="Risk Level" value={metrics?.riskLevel} icon={Activity} loading={loading} textValue />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/80">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-sky-700" />
              Live Port Operations Map
            </CardTitle>
            <CardDescription>Terminals, gates, yards, trucks and disruptions on the same OSM basemap.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/operator/map">Open full screen</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <Skeleton className="h-[420px] w-full rounded-none" />
          ) : (
            <div className="relative h-[420px] bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_45%,_#f8fafc_85%)]">
              <PortMap
                center={snapshot?.center}
                terminals={terminals}
                gates={gates}
                depots={depots}
                trucks={trucks}
                disruptions={disruptions}
                height="100%"
              />
              <div className="pointer-events-none absolute left-5 top-5 z-[400] rounded-xl border bg-white/92 p-3 text-xs shadow-sm backdrop-blur">
                <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Legend</div>
                <div className="mt-2 space-y-1">
                  <LegendRow color="bg-emerald-500" label="Healthy gate" />
                  <LegendRow color="bg-amber-500" label="Peak / restricted" />
                  <LegendRow color="bg-red-500" label="Critical / full" />
                  <LegendRow color="bg-blue-700" label="Pickup truck" />
                  <LegendRow color="bg-sky-500" label="Return-empty truck" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <CardTitle>Gate Load — last 6 hours window</CardTitle>
            <CardDescription>Real-time utilization vs peak window indicator.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Area type="monotone" dataKey="peak" stroke="#f59e0b" fill="url(#peakGrad)" strokeWidth={1} />
                    <Area type="monotone" dataKey="load" stroke="hsl(var(--primary))" fill="url(#loadGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 flex flex-col lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" /> Live Events
            </CardTitle>
            <CardDescription>Real-time system activities.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[300px] px-6">
              <div className="ml-2 space-y-6 border-l-2 border-muted pb-6 pl-6 pt-2">
                {logs.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Waiting for events...</span>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background',
                          i === 0 ? 'animate-pulse bg-green-500' : 'bg-muted-foreground/30',
                        )}
                      />
                      <p className={cn('text-sm', i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>{log}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Gate Pressure Snapshot
            </CardTitle>
            <CardDescription>Mirror of the live map so the operator can explain why AI starts rescheduling.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : gates.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No gate windows available yet.</div>
            ) : (
              gates.map((gate: any) => (
                <div key={gate.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{gate.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(gate.timeWindow.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(gate.timeWindow.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <StatusBadge status={gate.status} />
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-2 rounded-full',
                        gate.utilizationPct >= 90 ? 'bg-red-500' : gate.utilizationPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(gate.utilizationPct, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {gate.usedSlots}/{gate.maxSlots} slots used
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-primary" />
              Depot Network Load
            </CardTitle>
            <CardDescription>Where empty returns can absorb traffic right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              {loading || depotChartData.length === 0 ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={depotChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} width={110} />
                    <Tooltip formatter={(value: any) => `${value}%`} />
                    <Bar dataKey="load" radius={[0, 6, 6, 0]}>
                      {depotChartData.map((entry: any) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Impacted Bookings</CardTitle>
              <CardDescription>Shipments affected by current disruptions requiring attention.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search container..."
                  className="w-[200px] pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Container</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="p-4">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredImpacted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No impacted bookings found.
                    </td>
                  </tr>
                ) : (
                  filteredImpacted.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{item.request.container.containerNo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.request.company.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 font-medium text-red-600" title={item.blockedReason}>
                        {item.blockedReason}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Menu">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
          <Link href="/operator/capacity">
            <SlidersHorizontal className="h-4 w-4" />
            <div className="text-left">
              <div className="font-semibold">Capacity Manager</div>
              <div className="text-xs text-muted-foreground">Adjust gate slots and peak windows</div>
            </div>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
          <Link href="/operator/incidents">
            <AlertOctagon className="h-4 w-4" />
            <div className="text-left">
              <div className="font-semibold">Incidents</div>
              <div className="text-xs text-muted-foreground">Create disruptions and inspect impacts</div>
            </div>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
          <Link href="/operator/override">
            <HandMetal className="h-4 w-4" />
            <div className="text-left">
              <div className="font-semibold">Manual Override</div>
              <div className="text-xs text-muted-foreground">Block container / zone / gate</div>
            </div>
          </Link>
        </Button>
      </div>
    </PageContainer>
  );
}

function KpiCard({ title, value, unit, icon: Icon, loading, trend, alert, textValue }: any) {
  return (
    <Card className={cn(alert && 'border-red-200 bg-red-50')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn('h-4 w-4 text-muted-foreground', alert && 'text-red-500')} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="flex items-baseline space-x-2">
            <div className={cn('text-2xl font-bold', alert && 'text-red-700')}>
              {value}
              {!textValue && unit}
            </div>
            {trend && (
              <span className={cn('text-xs font-medium', trend === 'up' ? 'text-red-500' : 'text-green-500')}>
                {trend === 'up' ? '↑' : '↓'}
              </span>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{alert ? 'Requires attention' : 'Normal operation'}</p>
      </CardContent>
    </Card>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-3 w-3 rounded-full', color)} />
      <span>{label}</span>
    </div>
  );
}

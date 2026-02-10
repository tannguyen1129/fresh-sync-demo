'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS, CongestionUpdatePayload } from '@freshsync/shared';
import { 
  Activity, Truck, AlertOctagon, Anchor, Search, Filter, Zap, SlidersHorizontal, HandMetal, MoreHorizontal
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
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
import { PageContainer } from '@/components/common/PageContainer'; // Import mới
import { cn } from '@/lib/utils';

export default function OperatorDashboard() {
  const { socket } = useSocket();
  const [metrics, setMetrics] = useState<any>(null);
  const [impacted, setImpacted] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchData = async () => {
    try {
      const [metricsRes, impactedRes] = await Promise.all([
        api.get('/operator/monitor/congestion'),
        api.get('/operator/monitor/impacted')
      ]);
      setMetrics(metricsRes.data);
      setImpacted(impactedRes.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on(EVENTS.CONGESTION_UPDATED, (payload: CongestionUpdatePayload) => {
      setMetrics((prev: any) => ({
        ...prev,
        timestamp: payload.timestamp,
        metrics: {
          gateUtilization: payload.gateLoad,
          avgYardOccupancy: payload.yardOccupancy['ZONE_B'] || 50,
          activeDisruptions: payload.activeDisruptions
        }
      }));
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLogs(prev => [`[${time}] System updated: Gate load at ${payload.gateLoad}%`, ...prev.slice(0, 19)]);
    });
    socket.on(EVENTS.BOOKING_UPDATED, (payload: any) => {
        if (payload.status === 'BLOCKED' || payload.status === 'RESCHEDULED') {
            const time = new Date().toLocaleTimeString();
            setLogs(prev => [`[${time}] Booking ${payload.bookingId.slice(0,8)}... marked as ${payload.status}`, ...prev]);
            fetchData();
        }
    });
    return () => {
      socket.off(EVENTS.CONGESTION_UPDATED);
      socket.off(EVENTS.BOOKING_UPDATED);
    };
  }, [socket]);

  const chartData = [
    { time: '08:00', load: 45 }, { time: '09:00', load: 60 }, { time: '10:00', load: 85 },
    { time: '11:00', load: 70 }, { time: '12:00', load: 50 }, { time: '13:00', load: 65 },
    { time: '14:00', load: metrics?.metrics?.gateUtilization || 75 },
  ];

  const filteredImpacted = impacted.filter(item => {
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
                <Badge variant="outline" className="px-3 py-1 gap-2 border-green-200 bg-green-50 text-green-700">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Live Connection
                </Badge>
                <Button size="sm" variant="outline" onClick={fetchData}>Refresh</Button>
            </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Gate Utilization" value={metrics?.metrics?.gateUtilization} unit="%" icon={Truck} loading={loading} trend={metrics?.metrics?.gateUtilization > 80 ? 'up' : 'down'} />
        <KpiCard title="Yard Occupancy" value={metrics?.metrics?.avgYardOccupancy} unit="%" icon={Anchor} loading={loading} />
        <KpiCard title="Active Disruptions" value={metrics?.metrics?.activeDisruptions} icon={AlertOctagon} loading={loading} alert={metrics?.metrics?.activeDisruptions > 0} />
        <KpiCard title="Risk Level" value={metrics?.riskLevel} icon={Activity} loading={loading} textValue />
      </div>

      <div className="grid gap-4 md:grid-cols-12 lg:grid-cols-12">
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <CardTitle>Congestion Trends</CardTitle>
            <CardDescription>Gate traffic load over the last 6 hours.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
                {loading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Line type="monotone" dataKey="load" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-4 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /> Live Events</CardTitle>
            <CardDescription>Real-time system activities.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0">
             <ScrollArea className="h-[300px] px-6">
                <div className="space-y-6 pb-6 border-l-2 border-muted ml-2 pl-6 pt-2">
                    {logs.length === 0 ? <span className="text-sm text-muted-foreground">Waiting for events...</span> : logs.map((log, i) => (
                        <div key={i} className="relative">
                            <span className={cn("absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background", i === 0 ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30")}></span>
                            <p className={cn("text-sm", i === 0 ? "text-foreground font-medium" : "text-muted-foreground")}>{log}</p>
                        </div>
                    ))}
                </div>
             </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
         <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white"><AlertOctagon className="h-4 w-4" /> Create Disruption</Button>
         <Button variant="outline" className="gap-2"><SlidersHorizontal className="h-4 w-4" /> Adjust Capacity</Button>
         <Button variant="outline" className="gap-2"><HandMetal className="h-4 w-4" /> Manual Override</Button>
      </div>

      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div><CardTitle>Impacted Bookings</CardTitle><CardDescription>Shipments affected by current disruptions requiring attention.</CardDescription></div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search container..." className="pl-8 w-[200px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px]"><div className="flex items-center gap-2"><Filter className="h-4 w-4" /><SelectValue placeholder="Status" /></div></SelectTrigger>
                        <SelectContent><SelectItem value="ALL">All Status</SelectItem><SelectItem value="BLOCKED">Blocked</SelectItem><SelectItem value="RESCHEDULED">Rescheduled</SelectItem></SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-medium">
                        <tr><th className="px-4 py-3">Container</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={5} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>) : filteredImpacted.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No impacted bookings found.</td></tr>
                        ) : filteredImpacted.map((item) => (
                                <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-4 py-3 font-medium">{item.request.container.containerNo}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item.request.company.name}</td>
                                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                                    <td className="px-4 py-3 text-red-600 font-medium max-w-[200px] truncate" title={item.blockedReason}>{item.blockedReason}</td>
                                    <td className="px-4 py-3 text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Menu"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function KpiCard({ title, value, unit, icon: Icon, loading, trend, alert, textValue }: any) {
    return (
        <Card className={cn(alert && "border-red-200 bg-red-50")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className={cn("h-4 w-4 text-muted-foreground", alert && "text-red-500")} />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-20" /> : (
                    <div className="flex items-baseline space-x-2">
                        <div className={cn("text-2xl font-bold", alert && "text-red-700")}>{value}{!textValue && unit}</div>
                        {trend && <span className={cn("text-xs font-medium", trend === 'up' ? "text-red-500" : "text-green-500")}>{trend === 'up' ? '↑' : '↓'}</span>}
                    </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{alert ? "Requires attention" : "Normal operation"}</p>
            </CardContent>
        </Card>
    );
}
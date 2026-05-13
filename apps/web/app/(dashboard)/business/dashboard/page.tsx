'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  CalendarClock,
  ClipboardList,
  Container,
  ShieldAlert,
  Truck,
  BarChart3,
  BrainCircuit,
  Map as MapIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

const PortMap = dynamic(
  () => import('@/components/maps/PortMap').then((mod) => mod.PortMap),
  { ssr: false, loading: () => <Skeleton className="h-[360px] w-full rounded-none" /> },
);

export default function BusinessDashboard() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [bookingsRes, requestsRes, snapshotRes] = await Promise.all([
          api.get('/business/bookings'),
          api.get('/business/requests'),
          api.get('/meta/port-map-snapshot'),
        ]);
        setBookings(bookingsRes.data);
        setRequests(requestsRes.data);
        setSnapshot(snapshotRes.data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = useMemo(() => {
    const confirmed = bookings.filter((booking) => booking.status === 'CONFIRMED').length;
    const blocked = bookings.filter((booking) => booking.status === 'BLOCKED').length;
    const rescheduled = bookings.filter((booking) => booking.status === 'RESCHEDULED').length;
    const upcoming = bookings.filter((booking) => new Date(booking.confirmedSlotStart) > new Date()).length;

    return {
      totalRequests: requests.length,
      confirmed,
      blocked,
      rescheduled,
      upcoming,
    };
  }, [bookings, requests]);

  const upcomingBookings = bookings
    .filter((booking) => new Date(booking.confirmedSlotStart) > new Date())
    .slice(0, 5);

  const outcomeData = useMemo(
    () => [
      { label: 'Confirmed', value: stats.confirmed, fill: '#0f766e' },
      { label: 'Blocked', value: stats.blocked, fill: '#dc2626' },
      { label: 'Rescheduled', value: stats.rescheduled, fill: '#d97706' },
      { label: 'Upcoming', value: stats.upcoming, fill: '#2563eb' },
    ],
    [stats],
  );

  const riskDistribution = useMemo(() => {
    const buckets = { Low: 0, Medium: 0, High: 0 };
    requests.forEach((request) => {
      const score = request.recommendation?.riskScore;
      if (score == null) return;
      if (score < 30) buckets.Low += 1;
      else if (score < 70) buckets.Medium += 1;
      else buckets.High += 1;
    });
    return [
      { name: 'Low (<30)', value: buckets.Low, fill: '#16a34a' },
      { name: 'Medium (30-70)', value: buckets.Medium, fill: '#f59e0b' },
      { name: 'High (>70)', value: buckets.High, fill: '#dc2626' },
    ];
  }, [requests]);

  return (
    <PageContainer>
      <PageHeader
        title="Business Portal"
        subtitle="Monitor pickup demand, slot confirmations, and fleet-ready work."
        actions={
          <Button asChild>
            <Link href="/business/pickup">New Pickup Request</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard title="Pickup Requests" value={stats.totalRequests} icon={ClipboardList} loading={loading} />
        <DashboardCard title="Confirmed" value={stats.confirmed} icon={CalendarClock} loading={loading} />
        <DashboardCard title="Blocked" value={stats.blocked} icon={ShieldAlert} loading={loading} />
        <DashboardCard title="Rescheduled" value={stats.rescheduled} icon={Truck} loading={loading} />
        <DashboardCard title="Upcoming Slots" value={stats.upcoming} icon={Container} loading={loading} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-slate-50/80">
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-sky-700" />
            My Fleet on the Port Map
          </CardTitle>
          <CardDescription>Live positions of your active pickup and return-empty trucks, on top of the live port state.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <Skeleton className="h-[360px] w-full rounded-none" />
          ) : (
            <div className="h-[360px]">
              <PortMap
                center={snapshot?.center}
                terminals={snapshot?.terminals ?? []}
                gates={snapshot?.gates ?? []}
                depots={snapshot?.depots ?? []}
                trucks={snapshot?.trucks ?? []}
                disruptions={snapshot?.disruptions ?? []}
                height="100%"
                zoom={13}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              [...Array(4)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)
            ) : upcomingBookings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No confirmed bookings yet. Create a new pickup request to generate your first slot.
              </div>
            ) : (
              upcomingBookings.map((booking) => (
                <div key={booking.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{booking.request.container.containerNo}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(booking.confirmedSlotStart).toLocaleDateString()} •{' '}
                        {new Date(booking.confirmedSlotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Driver: {booking.assignments?.[0]?.driver?.name || 'Pending assignment'}
                      </div>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent AI Analyses</CardTitle>
            <CardDescription>How recent requests scored on the orchestration engine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              [...Array(4)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)
            ) : requests.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No pickup requests analyzed yet.
              </div>
            ) : (
              requests.slice(0, 5).map((request) => {
                const score = request.recommendation?.riskScore;
                const tone = score == null ? 'slate' : score < 30 ? 'emerald' : score < 70 ? 'amber' : 'red';
                return (
                  <div key={request.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{request.container.containerNo}</div>
                        <div className="text-sm text-muted-foreground">
                          {request.recommendation
                            ? `${new Date(request.recommendation.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Risk ${Math.round(request.recommendation.riskScore)}`
                            : 'Awaiting recommendation'}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          tone === 'emerald'
                            ? 'bg-emerald-100 text-emerald-700'
                            : tone === 'amber'
                              ? 'bg-amber-100 text-amber-700'
                              : tone === 'red'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {tone === 'slate' ? 'pending' : tone.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-2">
                      <StatusBadge status={request.booking ? request.booking.status : request.status} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Booking Outcomes
            </CardTitle>
            <CardDescription>Visibility into what the AI did with every request.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={outcomeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="label" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {outcomeData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" />
              AI Risk Distribution
            </CardTitle>
            <CardDescription>How safe were the slots the engine suggested?</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {riskDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" iconType="circle" />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Why FreshSync</CardTitle>
            <CardDescription>How orchestration shows up in your numbers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-emerald-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Stable AI Output</div>
              <div className="mt-1 text-2xl font-bold text-emerald-900">{Math.max(stats.confirmed - stats.rescheduled, 0)}</div>
              <div className="mt-1 text-xs text-emerald-800">confirmed plans holding their original slot</div>
            </div>
            <div className="rounded-xl border bg-amber-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Exception Logic</div>
              <div className="mt-1 text-2xl font-bold text-amber-900">{stats.blocked + stats.rescheduled}</div>
              <div className="mt-1 text-xs text-amber-800">cases where AI protected the port from bad arrivals</div>
            </div>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href="/business/roi">
                View ROI & Sustainability
                <Truck className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function DashboardCard({ title, value, icon: Icon, loading }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold tracking-tight">{value}</div>}
      </CardContent>
    </Card>
  );
}

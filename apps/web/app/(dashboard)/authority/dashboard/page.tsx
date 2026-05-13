'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import {
  BrainCircuit,
  Calendar as CalendarIcon,
  Clock,
  Download,
  Droplets,
  FileText,
  Leaf,
  Map as MapIcon,
  RefreshCw,
  Wind,
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
import { format, subDays } from 'date-fns';

const PortMap = dynamic(
  () => import('@/components/maps/PortMap').then((mod) => mod.PortMap),
  { ssr: false, loading: () => <div className="h-[360px] w-full animate-pulse bg-slate-100" /> },
);
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageContainer } from '@/components/common/PageContainer';
import { toast } from 'sonner';

export default function AuthorityDashboard() {
  const [reports, setReports] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [catLai, setCatLai] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [reportsRes, snapshotRes, catLaiRes] = await Promise.all([
        api.get(`/authority/esg?from=${dateRange.from}&to=${dateRange.to}`),
        api.get('/meta/port-map-snapshot'),
        api.get('/authority/esg/cat-lai-projection').catch(() => ({ data: null })),
      ]);
      const sorted = [...reportsRes.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setReports(sorted);
      setSnapshot(snapshotRes.data);
      setCatLai(catLaiRes?.data ?? null);
    } catch (error) {
      toast.error('Failed to load ESG reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange.from, dateRange.to]);

  const depotBreakdown = useMemo(() => {
    if (!snapshot?.depots) return [] as Array<{ name: string; load: number; status: string; fill: string }>;
    return snapshot.depots.map((depot: any) => ({
      name: depot.name.split('(')[0].trim(),
      load: depot.loadPct,
      status: depot.status,
      fill: depot.status === 'FULL' ? '#dc2626' : depot.loadPct > 80 ? '#f59e0b' : '#16a34a',
    }));
  }, [snapshot]);

  const handleExport = async () => {
    try {
      const response = await api.get('/authority/esg/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `esg-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report downloaded successfully');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleGenerateToday = async () => {
    setGenerating(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await api.post(`/authority/esg/generate?date=${today}`);
      await fetchReports();
      toast.success("Today's report generated");
    } catch (error) {
      toast.error('Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const totals = reports.reduce(
    (acc, report) => {
      const details = report.details ?? {};
      return {
        co2Reduced: acc.co2Reduced + report.co2Reduced,
        idleTimeSaved: acc.idleTimeSaved + report.idleTimeSaved,
        peakAvoided: acc.peakAvoided + report.peakAvoided,
        dieselSavedLiters: acc.dieselSavedLiters + (details.dieselSavedLiters ?? 0),
        fuelCostSavedUsd: acc.fuelCostSavedUsd + (details.fuelCostSavedUsd ?? 0),
      };
    },
    {
      co2Reduced: 0,
      idleTimeSaved: 0,
      peakAvoided: 0,
      dieselSavedLiters: 0,
      fuelCostSavedUsd: 0,
    },
  );

  const assumptions = reports[reports.length - 1]?.details?.assumptions;

  return (
    <PageContainer>
      <PageHeader
        title="Sustainability & ESG"
        subtitle="Environmental impact tracking, congestion avoidance, and transparent assumptions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerateToday} disabled={generating}>
              <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              Sync Today
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Date Range</span>
        </div>
        <Input type="date" className="w-auto" value={dateRange.from} onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))} />
        <span className="text-muted-foreground">-</span>
        <Input type="date" className="w-auto" value={dateRange.to} onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))} />
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-32 rounded-xl" />)}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 py-16 text-center">
          <div className="mb-4 rounded-full bg-green-100 p-4">
            <Leaf className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold">No Reports Found</h3>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Generate a report for today or adjust the date range to inspect seeded ESG history.
          </p>
          <Button variant="outline" className="mt-6" onClick={handleGenerateToday}>
            Generate Initial Report
          </Button>
        </div>
      ) : (
        <>
          <Card className="border bg-[radial-gradient(circle_at_top,_#dcfce7,_#f0fdf4_42%,_#f8fafc_85%)]">
            <CardContent className="grid gap-4 p-5 md:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  <BrainCircuit className="h-3.5 w-3.5 text-green-700" />
                  AI Impact Narrative
                </div>
                <div className="mt-2 text-2xl font-black tracking-tight">ESG metrics are downstream of operational decisions</div>
                <div className="mt-2 text-sm text-slate-600">
                  Peak avoidance, queue reduction, and JIT arrivals are the direct causes of diesel and CO₂ savings. This screen now ties those outcomes back to orchestration behavior.
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <AssumptionItem label="Peak Avoided" value={`${totals.peakAvoided} trucks`} />
                <AssumptionItem label="Idle Saved" value={`${totals.idleTimeSaved} mins`} />
                <AssumptionItem label="Diesel Saved" value={`${totals.dieselSavedLiters.toFixed(2)} L`} />
                <AssumptionItem label="CO₂ Reduced" value={`${totals.co2Reduced.toFixed(2)} kg`} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard title="CO₂ Reduced" value={`${totals.co2Reduced.toFixed(2)} kg`} subtitle="Direct emissions avoided" icon={Leaf} />
            <KpiCard title="Idle Time Saved" value={`${totals.idleTimeSaved} mins`} subtitle={`~${(totals.idleTimeSaved / 60).toFixed(1)} hours`} icon={Clock} />
            <KpiCard title="Peak Avoided" value={`${totals.peakAvoided} trucks`} subtitle="Shifted away from congestion" icon={Wind} />
            <KpiCard title="Diesel Saved" value={`${totals.dieselSavedLiters.toFixed(2)} L`} subtitle="Based on baseline idling burn rate" icon={Droplets} />
            <KpiCard title="Fuel Cost Saved" value={`$${totals.fuelCostSavedUsd.toFixed(2)}`} subtitle="Useful for adoption messaging" icon={FileText} />
          </div>

          {catLai ? (
            <Card className="border bg-gradient-to-br from-emerald-50 via-emerald-50/40 to-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-emerald-700" />
                  Cát Lái Green-Economy Projection (Expected Scenario)
                </CardTitle>
                <CardDescription>
                  Baseline {catLai.assumptions.baselineTrucks.toLocaleString()} trucks/day · FreshSync impacts {Math.round(catLai.assumptions.impactPct * 100)}% · reduces wait by {Math.round(catLai.assumptions.waitReductionPct * 100)}%.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <CatLaiTile label="Trucks impacted / day" value={catLai.projection.impactedTrucks.toLocaleString()} />
                <CatLaiTile label="Idle hours saved / day" value={`${catLai.projection.idleHoursSavedPerDay.toLocaleString()} h`} />
                <CatLaiTile label="Diesel saved / day" value={`${catLai.projection.dieselSavedLitersPerDay.toLocaleString()} L`} />
                <CatLaiTile label="CO₂ avoided / day" value={`${catLai.projection.co2TonsPerDay} t`} />
                <CatLaiTile label="CO₂ avoided / year" value={`${catLai.projection.co2TonsPerYear.toLocaleString()} t`} />
                <CatLaiTile label="Fuel cost saved / day" value={`₫${catLai.projection.fuelCostSavedVndPerDay.toLocaleString()}`} />
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-emerald-50/60">
              <CardTitle className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-emerald-700" />
                Port Network ESG Map
              </CardTitle>
              <CardDescription>Terminals, gate pressure, depot load, and active disruptions across the port network.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
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
                  showRoutes={false}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Depot Network Load</CardTitle>
                <CardDescription>Where the network can still absorb empty containers cleanly.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  {depotBreakdown.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No depot data yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={depotBreakdown} layout="vertical" margin={{ left: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                        <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                        <YAxis dataKey="name" type="category" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} width={120} />
                        <Tooltip formatter={(value: any, _: any, props: any) => [`${value}%`, props?.payload?.status]} />
                        <Bar dataKey="load" radius={[0, 6, 6, 0]}>
                          {depotBreakdown.map((entry: any) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Yard Pressure</CardTitle>
                <CardDescription>Real-time occupancy of port yard zones.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(snapshot?.yardStatuses ?? []).map((yard: any) => (
                  <div key={yard.zoneId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{yard.zoneId}</span>
                      <span className="text-muted-foreground">{yard.occupancyPct}% occupied</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${
                          yard.occupancyPct > 90 ? 'bg-red-500' : yard.occupancyPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(yard.occupancyPct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {(snapshot?.yardStatuses ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No yard data available.</div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Carbon Footprint Reduction</CardTitle>
                <CardDescription>Daily CO₂ savings trend over time.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reports}>
                      <defs>
                        <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'dd/MM')} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip labelFormatter={(label) => format(new Date(label), 'PPP')} />
                      <Area type="monotone" dataKey="co2Reduced" stroke="#16a34a" fill="url(#colorCo2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assumptions</CardTitle>
                <CardDescription>Explainable demo metrics for presenters and stakeholders.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <AssumptionItem label="Idle Minutes / Peak Avoided" value={`${assumptions?.idleMinutesPerPeakAvoided ?? 0} mins`} />
                <AssumptionItem label="Early Arrival Prevention" value={`${assumptions?.earlyArrivalMinutesSaved ?? 0} mins`} />
                <AssumptionItem label="Diesel Burn Rate" value={`${assumptions?.dieselLitersPerHour ?? 0} L/hour`} />
                <AssumptionItem label="Fuel Price" value={`$${assumptions?.fuelPriceUsdPerLiter ?? 0} / liter`} />
                <AssumptionItem label="CO₂ / Liter Diesel" value={`${assumptions?.co2KgPerLiter ?? 0} kg`} />
                <AssumptionItem label="Baseline Trips / Truck / Week" value={`${assumptions?.baselineTripsPerTruckWeek ?? 0}`} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Fuel Savings Trend</CardTitle>
                <CardDescription>Daily diesel savings derived from reduced idling.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reports.map((report) => ({
                      ...report,
                      dieselSavedLiters: report.details?.dieselSavedLiters ?? 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'dd/MM')} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="dieselSavedLiters" fill="#0f766e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Peak Shift Efficiency</CardTitle>
                <CardDescription>Trucks moved to lower-risk slots.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reports}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'dd/MM')} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="peakAvoided" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Daily Breakdown</CardTitle>
                  <CardDescription>Detailed sustainability and cost metrics per day.</CardDescription>
                </div>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Total Bookings</TableHead>
                    <TableHead>Peak Avoided</TableHead>
                    <TableHead>Idle Saved</TableHead>
                    <TableHead>Diesel</TableHead>
                    <TableHead className="text-right">Fuel Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...reports].reverse().map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{format(new Date(report.date), 'PPP')}</TableCell>
                      <TableCell>{report.details?.totalBookings ?? '-'}</TableCell>
                      <TableCell>{report.peakAvoided}</TableCell>
                      <TableCell>{report.idleTimeSaved} mins</TableCell>
                      <TableCell>{report.details?.dieselSavedLiters ?? 0} L</TableCell>
                      <TableCell className="text-right">${report.details?.fuelCostSavedUsd ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon }: { title: string; value: string; subtitle: string; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function AssumptionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function CatLaiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white/80 p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{label}</div>
      <div className="mt-1 text-xl font-black tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

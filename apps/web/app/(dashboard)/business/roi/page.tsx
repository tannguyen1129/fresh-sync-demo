'use client';

import { useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { api } from '@/lib/api';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplets, Fuel, Leaf, RefreshCw, TrendingUp, Truck } from 'lucide-react';
import { toast } from 'sonner';

export default function BusinessRoiPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/business/reports/roi?from=${dateRange.from}&to=${dateRange.to}`);
      setReport(data);
    } catch (error) {
      toast.error('Failed to load ROI report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateRange.from, dateRange.to]);

  const summary = report?.summary;
  const assumptions = report?.assumptions;
  const series = report?.series ?? [];
  const drivers = report?.driverBreakdown ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="ROI & Sustainability"
        subtitle="Translate orchestration performance into saved time, fuel, cash, and cleaner fleet operations."
        actions={
          <Button variant="outline" size="sm" onClick={fetchReport}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
        <span className="text-sm font-medium">Date Range</span>
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
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Idling Time Saved" value={`${summary?.idleTimeSaved ?? 0} mins`} hint={`Peak avoided: ${summary?.peakAvoided ?? 0}`} icon={TrendingUp} />
            <MetricCard title="Diesel Saved" value={`${summary?.dieselSavedLiters ?? 0} L`} hint={`${assumptions?.dieselLitersPerHour ?? 0} L/hour baseline`} icon={Droplets} />
            <MetricCard title="Fuel Cost Saved" value={`$${summary?.fuelCostSavedUsd ?? 0}`} hint={`Fuel price $${assumptions?.fuelPriceUsdPerLiter ?? 0}/L`} icon={Fuel} />
            <MetricCard title="CO₂ Reduced" value={`${summary?.co2Reduced ?? 0} kg`} hint={`${assumptions?.co2KgPerLiter ?? 0} kg/L diesel`} icon={Leaf} />
            <MetricCard title="Fleet Utilization" value={`${summary?.fleetUtilization ?? 0} trips/truck/week`} hint={`${summary?.completedTrips ?? 0} completed trips`} icon={Truck} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Daily Savings Trend</CardTitle>
                <CardDescription>Idle time and fuel savings over the selected period.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series}>
                      <defs>
                        <linearGradient id="idleArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd/MM')} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="idleTimeSaved" stroke="#0f766e" fill="url(#idleArea)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ROI Assumptions</CardTitle>
                <CardDescription>Transparent demo assumptions behind every metric.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <AssumptionRow label="Idle Minutes / Peak Avoided" value={`${assumptions?.idleMinutesPerPeakAvoided ?? 0} mins`} />
                <AssumptionRow label="Early Arrival Prevention" value={`${assumptions?.earlyArrivalMinutesSaved ?? 0} mins`} />
                <AssumptionRow label="Diesel Burn Rate" value={`${assumptions?.dieselLitersPerHour ?? 0} L/hour`} />
                <AssumptionRow label="Fuel Price" value={`$${assumptions?.fuelPriceUsdPerLiter ?? 0} / liter`} />
                <AssumptionRow label="CO₂ per Liter Diesel" value={`${assumptions?.co2KgPerLiter ?? 0} kg`} />
                <AssumptionRow label="Baseline Trips / Truck / Week" value={`${assumptions?.baselineTripsPerTruckWeek ?? 0}`} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>Daily Breakdown</CardTitle>
                <CardDescription>Per-day operational and sustainability value.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bookings</TableHead>
                      <TableHead>Idle Saved</TableHead>
                      <TableHead>Diesel</TableHead>
                      <TableHead className="text-right">Fuel Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {series.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No ROI data in this range.</TableCell>
                      </TableRow>
                    ) : series.map((item: any) => (
                      <TableRow key={item.date}>
                        <TableCell className="font-medium">{format(new Date(item.date), 'PPP')}</TableCell>
                        <TableCell>{item.totalBookings}</TableCell>
                        <TableCell>{item.idleTimeSaved} mins</TableCell>
                        <TableCell>{item.dieselSavedLiters} L</TableCell>
                        <TableCell className="text-right">${item.fuelCostSavedUsd}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Driver Contribution</CardTitle>
                <CardDescription>Completed pickups per driver in the selected range.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={drivers}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="driverName" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="completedTrips" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {drivers.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No completed driver activity in this range.</div>
                  ) : drivers.map((driver: any) => (
                    <div key={driver.driverName} className="rounded-lg border p-3">
                      <div className="font-medium">{driver.driverName}</div>
                      <div className="text-sm text-muted-foreground">{driver.completedTrips} completed trips</div>
                      <div className="mt-1 text-xs text-muted-foreground">{driver.containersHandled}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}

function MetricCard({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function AssumptionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

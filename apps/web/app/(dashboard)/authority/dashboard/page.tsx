'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { 
  Leaf, 
  Wind, 
  Clock, 
  Download, 
  Calendar as CalendarIcon, 
  RefreshCw, 
  TrendingUp, 
  FileText
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format, subDays } from 'date-fns';
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
  TableRow 
} from '@/components/ui/table';
import { PageHeader } from '@/components/common/PageHeader';
import { toast } from 'sonner';

export default function AuthorityDashboard() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Date Filter State
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Append query params
      const { data } = await api.get(`/authority/esg?from=${dateRange.from}&to=${dateRange.to}`);
      const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setReports(sorted);
    } catch (e) {
      toast.error("Failed to load ESG reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

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
      toast.success("Report downloaded successfully");
    } catch (e) {
      toast.error("Export failed");
    }
  };

  const handleGenerateToday = async () => {
    setGenerating(true);
    try {
        const today = format(new Date(), 'yyyy-MM-dd');
        await api.post(`/authority/esg/generate?date=${today}`);
        await fetchReports();
        toast.success("Today's report generated");
    } catch (e) {
        toast.error("Generation failed");
    } finally {
        setGenerating(false);
    }
  };

  // KPI Calculations
  const totalCO2 = reports.reduce((acc, curr) => acc + curr.co2Reduced, 0).toFixed(2);
  const totalIdleTime = reports.reduce((acc, curr) => acc + curr.idleTimeSaved, 0);
  const totalPeakAvoided = reports.reduce((acc, curr) => acc + curr.peakAvoided, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Sustainability & ESG" 
        subtitle="Environmental impact tracking and efficiency metrics."
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

      {/* --- Filter Bar --- */}
      <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Date Range:</span>
        </div>
        <Input 
            type="date" 
            className="w-auto" 
            value={dateRange.from}
            onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
        />
        <span className="text-muted-foreground">-</span>
        <Input 
            type="date" 
            className="w-auto" 
            value={dateRange.to}
            onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
            <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : reports.length === 0 ? (
        // --- Empty State ---
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <div className="bg-green-100 p-4 rounded-full mb-4">
                <Leaf className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">No Reports Found</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
                There is no data for the selected period. Try adjusting the date range or generate a new report.
            </p>
            <Button variant="outline" className="mt-6" onClick={handleGenerateToday}>
                Generate Initial Report
            </Button>
        </div>
      ) : (
        <>
            {/* --- KPI Cards --- */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">CO₂ Emissions Reduced</CardTitle>
                        <Leaf className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCO2} <span className="text-sm font-normal text-muted-foreground">kg</span></div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center">
                            <TrendingUp className="mr-1 h-3 w-3 text-green-600" /> 
                            Direct impact from route optimization
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Idle Time Saved</CardTitle>
                        <Clock className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalIdleTime} <span className="text-sm font-normal text-muted-foreground">mins</span></div>
                        <p className="text-xs text-muted-foreground mt-1">
                            ~{(totalIdleTime / 60).toFixed(1)} hours of engine runtime avoided
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Congestion Prevented</CardTitle>
                        <Wind className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalPeakAvoided} <span className="text-sm font-normal text-muted-foreground">trucks</span></div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Shifted from Peak to Off-Peak hours
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* --- Charts --- */}
            <div className="grid gap-4 md:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Carbon Footprint Reduction</CardTitle>
                        <CardDescription>Daily CO₂ savings trend over time.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={reports}>
                                    <defs>
                                        <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={(date) => format(new Date(date), 'dd/MM')} 
                                        stroke="#888888" 
                                        fontSize={12} 
                                        tickLine={false} 
                                        axisLine={false} 
                                    />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelFormatter={(label) => format(new Date(label), 'PPP')}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="co2Reduced" 
                                        stroke="#16a34a" 
                                        fillOpacity={1} 
                                        fill="url(#colorCo2)" 
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Peak Shift Efficiency</CardTitle>
                        <CardDescription>Trucks moved to green slots.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={reports}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={(date) => format(new Date(date), 'dd/MM')} 
                                        stroke="#888888" 
                                        fontSize={12} 
                                        tickLine={false} 
                                        axisLine={false} 
                                    />
                                    <Tooltip 
                                        cursor={{fill: 'transparent'}}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="peakAvoided" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- Summary Table --- */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Daily Breakdown</CardTitle>
                            <CardDescription>Detailed metrics per day.</CardDescription>
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
                                <TableHead>Idle Time Saved</TableHead>
                                <TableHead className="text-right">CO₂ Reduced</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...reports].reverse().map((report, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{format(new Date(report.date), 'PPP')}</TableCell>
                                    <TableCell>{(report.details as any)?.totalBookings || '-'}</TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                            {report.peakAvoided} trucks
                                        </span>
                                    </TableCell>
                                    <TableCell>{report.idleTimeSaved} mins</TableCell>
                                    <TableCell className="text-right font-bold text-green-600">
                                        -{report.co2Reduced} kg
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </>
      )}
    </div>
  );
}
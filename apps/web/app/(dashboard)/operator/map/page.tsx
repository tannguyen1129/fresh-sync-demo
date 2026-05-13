'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS } from '@freshsync/shared';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Anchor,
  Clock3,
  Map,
  RefreshCw,
  TrafficCone,
  Truck,
  Waves,
  Zap,
  BrainCircuit,
  ScanSearch,
  Route,
} from 'lucide-react';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const OperatorLiveMap = dynamic(
  () => import('@/components/maps/OperatorLiveMap').then((mod) => mod.OperatorLiveMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[560px] w-full rounded-none" />,
  },
);

const SCENARIOS = [
  { key: 'PEAK_HOUR', label: 'Peak Hour', icon: TrafficCone, tone: 'amber' },
  { key: 'TERMINAL_OVERLOAD', label: 'Terminal Overload', icon: Anchor, tone: 'red' },
  { key: 'ACCIDENT_NEAR_PORT', label: 'Accident Delay', icon: AlertTriangle, tone: 'orange' },
];

export default function OperatorMapPage() {
  const { socket } = useSocket();
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);

  const fetchSnapshot = async () => {
    try {
      const { data } = await api.get('/operator/map/snapshot');
      setSnapshot(data);
    } catch (error) {
      toast.error('Failed to load live map snapshot');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => void fetchSnapshot();
    socket.on(EVENTS.CONGESTION_UPDATED, refresh);
    socket.on(EVENTS.DISRUPTION_CREATED, refresh);
    socket.on(EVENTS.BOOKING_UPDATED, refresh);
    socket.on(EVENTS.DRIVER_ASSIGNMENT_UPDATED, refresh);
    socket.on(EVENTS.DRIVER_ASSIGNMENT_CREATED, refresh);
    return () => {
      socket.off(EVENTS.CONGESTION_UPDATED, refresh);
      socket.off(EVENTS.DISRUPTION_CREATED, refresh);
      socket.off(EVENTS.BOOKING_UPDATED, refresh);
      socket.off(EVENTS.DRIVER_ASSIGNMENT_UPDATED, refresh);
      socket.off(EVENTS.DRIVER_ASSIGNMENT_CREATED, refresh);
    };
  }, [socket]);

  const triggerScenario = async (type: string) => {
    setRunningScenario(type);
    try {
      const { data } = await api.post(`/operator/scenarios/${type}/start`);
      toast.success(data.message || `${type} started`);
      await fetchSnapshot();
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to run ${type}`);
    } finally {
      setRunningScenario(null);
    }
  };

  const resetScenario = async () => {
    setRunningScenario('RESET');
    try {
      await api.post('/operator/scenarios/reset');
      toast.success('Simulation state reset');
      await fetchSnapshot();
    } catch (error) {
      toast.error('Reset failed');
    } finally {
      setRunningScenario(null);
    }
  };

  const disruptions = snapshot?.disruptions ?? [];
  const trucks = snapshot?.trucks ?? [];
  const gates = snapshot?.gates ?? [];
  const yards = snapshot?.yardStatuses ?? [];
  const terminals = snapshot?.terminals ?? [];
  const aiSignals = buildAiSignals({ disruptions, trucks, gates, yards });

  return (
    <PageContainer>
      <PageHeader
        title="Live Port Map"
        subtitle="A visual control tower for gates, yard pressure, truck movement, and scenario-based AI intervention."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              <Waves className="mr-1 h-3.5 w-3.5" />
              Real-time snapshot
            </Badge>
            <Button size="sm" variant="outline" onClick={fetchSnapshot}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MapKpi title="Tracked Trucks" value={trucks.length} icon={Truck} loading={loading} />
        <MapKpi title="Active Disruptions" value={disruptions.length} icon={AlertTriangle} loading={loading} />
        <MapKpi title="Active Gates" value={gates.length} icon={Anchor} loading={loading} />
        <MapKpi title="Snapshot Time" value={snapshot?.updatedAt ? new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'} icon={Clock3} loading={loading} />
      </div>

      <div className="flex flex-wrap gap-3">
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          return (
            <Button
              key={scenario.key}
              type="button"
              variant="outline"
              className={cn(
                'gap-2',
                scenario.tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
                scenario.tone === 'red' && 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
                scenario.tone === 'orange' && 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100',
              )}
              disabled={runningScenario !== null}
              onClick={() => triggerScenario(scenario.key)}
            >
              <Icon className="h-4 w-4" />
              {runningScenario === scenario.key ? 'Running...' : scenario.label}
            </Button>
          );
        })}
        <Button type="button" variant="secondary" disabled={runningScenario !== null} onClick={resetScenario}>
          {runningScenario === 'RESET' ? 'Resetting...' : 'Reset Simulation'}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-slate-50/80">
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5 text-sky-700" />
              OpenStreetMap Control Layer
            </CardTitle>
            <CardDescription>Terminal blocks, gate pressure, truck routes, and incident radiuses are rendered on a real OSM basemap.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <Skeleton className="h-[560px] w-full rounded-none" />
            ) : (
              <div className="relative h-[560px] overflow-hidden bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_45%,_#f8fafc_85%)]">
                <OperatorLiveMap
                  center={snapshot?.center}
                  terminals={terminals}
                  gates={gates}
                  trucks={trucks}
                  disruptions={disruptions}
                />

                <div className="absolute left-5 top-5 rounded-xl border bg-white/92 p-4 shadow-sm backdrop-blur">
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Map Legend</div>
                  <div className="mt-3 space-y-2 text-sm">
                    <LegendRow color="bg-emerald-500" label="Healthy slot / terminal" />
                    <LegendRow color="bg-amber-500" label="Restricted / overloaded" />
                    <LegendRow color="bg-red-500" label="Critical disruption" />
                    <LegendRow color="bg-blue-700" label="Pickup truck" />
                    <LegendRow color="bg-sky-500" label="Return-empty truck" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                AI Orchestration Pulse
              </CardTitle>
              <CardDescription>What the engine is seeing and why it is about to redirect, delay, or protect capacity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : aiSignals.map((signal) => (
                <div key={signal.title} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{signal.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{signal.summary}</div>
                    </div>
                    <Badge variant={signal.tone === 'critical' ? 'destructive' : 'outline'}>{signal.badge}</Badge>
                  </div>
                  <div className="mt-3 flex items-start gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {signal.icon}
                    <span>{signal.action}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gate Pressure</CardTitle>
              <CardDescription>Upcoming windows that AI uses for slot decisions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : gates.map((gate: any) => (
                <div key={gate.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{gate.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(gate.timeWindow.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(gate.timeWindow.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge variant={gate.utilizationPct > 90 ? 'destructive' : 'outline'}>{gate.utilizationPct}%</Badge>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-2 rounded-full',
                        gate.utilizationPct > 90 ? 'bg-red-500' : gate.utilizationPct > 70 ? 'bg-amber-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(gate.utilizationPct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Yard Heat</CardTitle>
              <CardDescription>Occupancy-based congestion zones that feed AI risk scoring.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : yards.map((yard: any) => (
                <div key={yard.zoneId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{yard.zoneId}</span>
                    <span className="text-muted-foreground">{yard.occupancyPct}% occupied</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-2 rounded-full',
                        yard.occupancyPct > 90 ? 'bg-red-500' : yard.occupancyPct > 70 ? 'bg-amber-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(yard.occupancyPct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Alerts</CardTitle>
              <CardDescription>Scenario-driven incidents and disruptions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : disruptions.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No active disruption. Use the scenario buttons above to simulate peak or incident conditions.
                </div>
              ) : disruptions.map((disruption: any) => (
                <div key={disruption.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{disruption.type.replace(/_/g, ' ')}</div>
                    <Badge variant={disruption.severity === 'CRITICAL' ? 'destructive' : 'outline'}>{disruption.severity}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{disruption.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-slate-500">
                    Zones: {disruption.affectedZones.join(', ')}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function MapKpi({ title, value, icon: Icon, loading }: { title: string; value: string | number; icon: any; loading: boolean }) {
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

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-3 w-3 rounded-full', color)} />
      <span>{label}</span>
    </div>
  );
}

function buildAiSignals({
  disruptions,
  trucks,
  gates,
  yards,
}: {
  disruptions: any[];
  trucks: any[];
  gates: any[];
  yards: any[];
}) {
  const hottestGate = [...gates].sort((a, b) => b.utilizationPct - a.utilizationPct)[0];
  const hottestYard = [...yards].sort((a, b) => b.occupancyPct - a.occupancyPct)[0];
  const activePickupTrucks = trucks.filter((truck) => truck.type === 'PICKUP').length;

  return [
    {
      title: 'Gate balancing',
      summary: hottestGate
        ? `${hottestGate.label} is at ${hottestGate.utilizationPct}% utilization, so the planner will bias new slots toward lower-pressure gates.`
        : 'Gate allocation engine is waiting for fresh capacity data.',
      badge: hottestGate ? `${hottestGate.utilizationPct}% load` : 'No data',
      tone: hottestGate?.utilizationPct >= 90 ? 'critical' : 'normal',
      action: hottestGate?.utilizationPct >= 90 ? 'AI will reschedule or defer non-priority jobs' : 'AI keeps gate windows balanced',
      icon: <Route className="mt-0.5 h-3.5 w-3.5" />,
    },
    {
      title: 'Yard relief',
      summary: hottestYard
        ? `${hottestYard.zoneId} sits at ${hottestYard.occupancyPct}% occupancy, which feeds directly into recommendation risk scoring.`
        : 'Yard pressure is within acceptable thresholds.',
      badge: hottestYard ? `${hottestYard.zoneId}` : 'Stable',
      tone: hottestYard?.occupancyPct >= 90 ? 'critical' : 'normal',
      action: hottestYard?.occupancyPct >= 90 ? 'AI will redirect traffic away from the congested zone' : 'AI keeps regular routing active',
      icon: <ScanSearch className="mt-0.5 h-3.5 w-3.5" />,
    },
    {
      title: 'Fleet orchestration',
      summary: `${activePickupTrucks} pickup trucks are being sequenced against live gate windows and disruption zones.`,
      badge: disruptions.length > 0 ? `${disruptions.length} incidents` : 'Normal flow',
      tone: disruptions.length > 0 ? 'critical' : 'normal',
      action: disruptions.length > 0 ? 'AI injects delay alerts and re-optimizes ETA guidance' : 'AI keeps JIT arrival guidance aligned',
      icon: <Truck className="mt-0.5 h-3.5 w-3.5" />,
    },
  ];
}

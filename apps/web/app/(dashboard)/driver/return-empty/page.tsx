'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Truck, MapPin, ArrowRight, Loader2, Clock3, Gauge, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/common/PageContainer';
import { cn } from '@/lib/utils';

const DepotMap = dynamic(
  () => import('@/components/maps/DepotMap').then((mod) => mod.DepotMap),
  { ssr: false, loading: () => <Skeleton className="h-[360px] w-full rounded-xl" /> },
);

const DRIVER_FALLBACK = { lat: 10.845, lng: 106.81 };

function ReturnEmptyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');

  const [analyzing, setAnalyzing] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [depots, setDepots] = useState<any[]>([]);
  const [position, setPosition] = useState(DRIVER_FALLBACK);

  useEffect(() => {
    if (assignmentId) {
      const timer = setTimeout(() => handleAnalyze(), 800);
      return () => clearTimeout(timer);
    }
  }, [assignmentId]);

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        const { data } = await api.get('/meta/port-map-snapshot');
        setDepots(data.depots ?? []);
      } catch (error) {
        console.error(error);
      }
    };
    loadSnapshot();
  }, []);

  const handleAnalyze = async () => {
    try {
      const { data } = await api.post('/driver/return-empty', {
        assignmentId,
        currentLat: position.lat,
        currentLng: position.lng,
      });
      setResult(data);
    } catch (error) {
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartReturn = () => {
    if (result?.assignment?.id) {
      router.push(`/driver/assignments/${result.assignment.id}`);
    }
  };

  if (!assignmentId) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Missing assignment ID. Open this page from a completed pickup assignment.
      </div>
    );
  }

  const recommendation = result?.recommendation;
  const alternatives = (result?.candidates ?? []).filter((depot: any) => depot.name !== recommendation?.depotName);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_45%,_#f8fafc_85%)] p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Smart Empty Return</div>
        <h1 className="mt-1 text-2xl font-black tracking-tight">AI picks the best depot for your empty container</h1>
        <p className="mt-1 text-sm text-slate-600">
          The engine filters depots by allowed list, current load, and distance — then ranks them so you don&apos;t waste fuel.
        </p>
      </div>

      {analyzing ? (
        <Card className="border-dashed">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <Truck className="absolute inset-0 m-auto h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Finding Best Depot...</h2>
              <p className="text-slate-500">Analyzing traffic, capacity and shipping line rules.</p>
            </div>
          </CardContent>
        </Card>
      ) : !recommendation ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center text-sm text-red-700">
            Could not generate a depot recommendation. Try refreshing the assignment.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <DepotMap
              driverLat={position.lat}
              driverLng={position.lng}
              driverName="Your truck"
              containerNo={recommendation?.containerNo}
              depots={depots}
              recommendedDepotName={recommendation.depotName}
              height={360}
            />
          </Card>

          <Card className="overflow-hidden border-2 border-green-500 shadow-xl">
            <div className="flex items-center justify-between bg-green-500 p-4 text-white">
              <span className="flex items-center font-bold">
                <MapPin className="mr-2 h-5 w-5" />
                AI Recommended
              </span>
              <Badge variant="secondary" className="border-none bg-white/20 text-white hover:bg-white/30">
                {Number(recommendation.distance).toFixed(1)} km
              </Badge>
            </div>
            <CardContent className="space-y-4 p-6">
              <div className="text-center">
                <div className="text-3xl font-black tracking-tight text-slate-800">{recommendation.depotName}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">Lowest score wins</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Traffic" value={recommendation.trafficLevel} tone="emerald" />
                <Metric label="Est. Time" value={`${recommendation.estimatedMinutes} min`} tone="slate" />
                <Metric label="Utilization" value={`${recommendation.utilizationPct}%`} tone={recommendation.utilizationPct > 75 ? 'amber' : 'slate'} />
                <Metric label="Assignment" value={result.assignment.status} tone="slate" />
              </div>

              <div className="rounded-lg bg-green-50 p-3 text-sm italic text-green-700">
                &ldquo;{recommendation.reason}&rdquo;
              </div>

              <Button onClick={handleStartReturn} className="h-12 w-full bg-green-600 text-base font-bold hover:bg-green-700">
                Navigate to Depot <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>

          {alternatives.length > 0 ? (
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Other candidates
                </div>
                {alternatives.map((depot: any) => (
                  <div key={depot.name} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{depot.name}</div>
                        <div className="text-xs text-muted-foreground">{depot.reason || depot.status}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="flex items-center justify-end gap-1 text-muted-foreground">
                          <Gauge className="h-3.5 w-3.5" /> {depot.utilizationPct}%
                        </div>
                        <div className="flex items-center justify-end gap-1 text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" /> {depot.estimatedMinutes ?? '—'} min
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: 'emerald' | 'amber' | 'slate' }) {
  return (
    <div
      className={cn(
        'rounded-lg p-3',
        tone === 'emerald' && 'bg-emerald-50 text-emerald-700',
        tone === 'amber' && 'bg-amber-50 text-amber-700',
        tone === 'slate' && 'bg-slate-100 text-slate-700',
      )}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

export default function ReturnEmptyPage() {
  return (
    <PageContainer className="max-w-2xl mx-auto pb-20">
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
        <ReturnEmptyContent />
      </Suspense>
    </PageContainer>
  );
}

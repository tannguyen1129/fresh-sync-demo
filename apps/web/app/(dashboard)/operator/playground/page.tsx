'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { RotateCcw, TrafficCone, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { PageContainer } from '@/components/common/PageContainer';

export default function OperatorPlaygroundPage() {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
  };

  const runAction = async (label: string, request: () => Promise<any>) => {
    setLoading(true);
    try {
      const result = await request();
      addLog(`SUCCESS ${label}: ${result?.data?.message || 'completed'}`);
    } catch (error: any) {
      addLog(`FAILED ${label}: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Demo Playground" subtitle="Fast trigger buttons for Sprint 4 control tower storytelling." />

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrafficCone className="h-5 w-5 text-amber-600" /> Simulate Gate Congestion</CardTitle>
            <CardDescription>Blocks `GATE_1` and lets the queue reschedule impacted bookings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              disabled={loading}
              onClick={() => runAction('Gate congestion', () => api.post('/operator/override/block', {
                targetType: 'GATE',
                targetId: 'GATE_1',
                reason: 'Long queue at Gate 1',
              }))}
            >
              Trigger GATE_1 Congestion
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TriangleAlert className="h-5 w-5 text-red-600" /> Simulate D/O HOLD</CardTitle>
            <CardDescription>Blocks `CONT-001` and forces the active booking into `BLOCKED`.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={loading}
              onClick={() => runAction('D/O HOLD', () => api.post('/operator/override/block', {
                targetType: 'CONTAINER',
                targetId: 'CONT-001',
                reason: 'Commercial hold for demo',
              }))}
            >
              Trigger CONT-001 HOLD
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-sky-600" /> Reset Scenario</CardTitle>
            <CardDescription>Clears active disruptions and restores demo bookings affected during Sprint 4.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={() => runAction('Reset scenario', () => api.post('/operator/playground/reset'))}
            >
              Reset Sprint 4 State
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Execution Log</CardTitle>
          <CardDescription>Use this during the demo to confirm what the control tower just triggered.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-emerald-400">
            {log.length === 0 ? (
              <div className="text-slate-500">// waiting for operator actions...</div>
            ) : log.map((entry, index) => (
              <div key={`${entry}-${index}`}>{entry}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

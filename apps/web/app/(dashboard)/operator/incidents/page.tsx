'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';
import { PageContainer } from '@/components/common/PageContainer';
import { Badge } from '@/components/ui/badge';

export default function IncidentsPage() {
  const [loading, setLoading] = useState(false);
  const [disruptions, setDisruptions] = useState<any[]>([]);
  const [impacted, setImpacted] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    type: 'CRANE_BREAKDOWN',
    severity: 'HIGH',
    affectedZones: 'ZONE_B',
    description: 'QC-03 hydraulic fault at Zone B',
  });

  const fetchData = async () => {
    try {
      const [disruptionsRes, impactedRes] = await Promise.all([
        api.get('/operator/disruptions'),
        api.get('/operator/monitor/impacted'),
      ]);
      setDisruptions(disruptionsRes.data);
      setImpacted(impactedRes.data);
    } catch (error) {
      toast.error('Failed to load incident data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/operator/disruptions', {
        type: formData.type,
        severity: formData.severity,
        startTime: new Date().toISOString(),
        affectedZones: formData.affectedZones.split(',').map((item) => item.trim()).filter(Boolean),
        description: formData.description,
      });
      toast.success('Disruption created');
      await fetchData();
    } catch (error) {
      toast.error('Failed to create disruption');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Incidents & Re-optimization"
        subtitle="Create disruptions and inspect which bookings were rescheduled or blocked."
        actions={
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create Disruption</CardTitle>
            <CardDescription>Operator-side incident creation with queue-triggered re-optimization.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Type</label>
                <select className="w-full rounded-md border bg-background p-2 text-sm" value={formData.type} onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value="CRANE_BREAKDOWN">CRANE_BREAKDOWN</option>
                  <option value="GATE_CONGESTION">GATE_CONGESTION</option>
                  <option value="SYSTEM_MAINTENANCE">SYSTEM_MAINTENANCE</option>
                  <option value="VESSEL_DELAY">VESSEL_DELAY</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Severity</label>
                <select className="w-full rounded-md border bg-background p-2 text-sm" value={formData.severity} onChange={(e) => setFormData((prev) => ({ ...prev, severity: e.target.value }))}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Affected Zones / Gates</label>
                <Input value={formData.affectedZones} onChange={(e) => setFormData((prev) => ({ ...prev, affectedZones: e.target.value }))} placeholder="ZONE_B, GATE_1" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Description</label>
                <textarea
                  className="min-h-[110px] w-full rounded-md border bg-background p-3 text-sm"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                {loading ? 'Creating...' : 'Create Disruption'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Disruptions</CardTitle>
              <CardDescription>These incidents are currently affecting routing and slot orchestration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {disruptions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No active disruptions.
                </div>
              ) : disruptions.map((disruption) => (
                <div key={disruption.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{disruption.description}</p>
                      <p className="text-xs text-muted-foreground">{disruption.affectedZones.join(', ')}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{disruption.type}</Badge>
                      <Badge variant="outline">{disruption.severity}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Impacted Bookings</CardTitle>
              <CardDescription>Bookings re-routed or blocked by the latest incidents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {impacted.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No impacted bookings yet.
                </div>
              ) : impacted.map((booking) => (
                <div key={booking.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{booking.request.container.containerNo}</p>
                      <p className="text-xs text-muted-foreground">{booking.request.company.name}</p>
                    </div>
                    <Badge variant="outline">{booking.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{booking.blockedReason || 'No reason supplied'}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

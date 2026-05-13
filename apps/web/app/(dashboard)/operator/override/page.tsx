'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Lock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { PageContainer } from '@/components/common/PageContainer';

const TARGET_PRESETS: Record<string, string[]> = {
  CONTAINER: ['CONT-001', 'CONT-003', 'CONT-013'],
  ZONE: ['ZONE_A', 'ZONE_B', 'ZONE_REEFER'],
  GATE: ['GATE_1', 'GATE_2', 'GATE_COLD'],
};

export default function OverridePage() {
  const [targetType, setTargetType] = useState('CONTAINER');
  const [targetId, setTargetId] = useState('CONT-001');
  const [reason, setReason] = useState('Manual intervention for demo scenario');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult('');
    try {
      const { data } = await api.post('/operator/override/block', {
        targetType,
        targetId,
        reason,
      });
      setResult(data.message);
      toast.success('Override applied');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to apply override';
      setResult(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Manual Override" subtitle="Block container, zone or gate and force orchestration to react immediately." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-600" /> Emergency Control</CardTitle>
          <CardDescription>Container block changes D/O state to HOLD. Zone and gate block create disruptions and trigger re-optimization.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap gap-2">
            {['CONTAINER', 'ZONE', 'GATE'].map((type) => (
              <Button key={type} type="button" variant={targetType === type ? 'default' : 'outline'} onClick={() => {
                setTargetType(type);
                setTargetId(TARGET_PRESETS[type][0]);
              }}>
                {type}
              </Button>
            ))}
          </div>

          <form onSubmit={handleBlock} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Suggested Targets</label>
              <div className="flex flex-wrap gap-2">
                {TARGET_PRESETS[targetType].map((preset) => (
                  <Badge key={preset} variant="outline" className="cursor-pointer" onClick={() => setTargetId(preset)}>
                    {preset}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Target ID</label>
              <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Reason</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              <Lock className="mr-2 h-4 w-4" />
              {loading ? 'Applying...' : 'Apply Override'}
            </Button>
          </form>

          {result && (
            <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/common/PageHeader';
import { PageContainer } from '@/components/common/PageContainer';

export default function CapacityPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [formData, setFormData] = useState({
    date: today,
    startHour: 8,
    slots: 100,
    usedSlots: 20,
  });
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);

  const fetchCapacities = async () => {
    try {
      const from = `${formData.date}T00:00:00.000Z`;
      const to = `${formData.date}T23:59:59.999Z`;
      const { data } = await api.get(`/operator/capacity/gate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setSlots(data);
    } catch (error) {
      toast.error('Failed to load capacity windows');
    }
  };

  useEffect(() => {
    fetchCapacities();
  }, [formData.date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const start = new Date(`${formData.date}T${String(formData.startHour).padStart(2, '0')}:00:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    try {
      await api.post('/operator/capacity/gate', {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        maxSlots: Number(formData.slots),
        usedSlots: Number(formData.usedSlots),
      });
      toast.success('Capacity window upserted');
      await fetchCapacities();
    } catch (error) {
      toast.error('Failed to update capacity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Capacity Manager"
        subtitle="Upsert gate slots and monitor used versus available capacity."
        actions={
          <Button variant="outline" size="sm" onClick={fetchCapacities}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upsert Window</CardTitle>
            <CardDescription>Create or overwrite a gate slot for the selected hour.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Date</label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Start Hour</label>
                <Input type="number" min="0" max="23" value={formData.startHour} onChange={(e) => setFormData((prev) => ({ ...prev, startHour: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Max Slots</label>
                <Input type="number" min="0" value={formData.slots} onChange={(e) => setFormData((prev) => ({ ...prev, slots: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Used Slots</label>
                <Input type="number" min="0" value={formData.usedSlots} onChange={(e) => setFormData((prev) => ({ ...prev, usedSlots: Number(e.target.value) }))} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                {loading ? 'Saving...' : 'Save Capacity Window'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time Windows</CardTitle>
            <CardDescription>Status is derived from utilization and visible immediately after upsert.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Window</TableHead>
                  <TableHead>Used / Max</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Peak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No capacity windows for this date.
                    </TableCell>
                  </TableRow>
                ) : slots.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell>
                      {format(new Date(slot.startTime), 'HH:mm')} - {format(new Date(slot.endTime), 'HH:mm')}
                    </TableCell>
                    <TableCell>{slot.usedSlots} / {slot.maxSlots}</TableCell>
                    <TableCell><CapacityBadge status={slot.status} /></TableCell>
                    <TableCell>{slot.isPeakHour ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function CapacityBadge({ status }: { status: string }) {
  const tone =
    status === 'CLOSED'
      ? 'bg-red-100 text-red-700 border-red-200'
      : status === 'RESTRICTED'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  return <Badge variant="outline" className={tone}>{status}</Badge>;
}

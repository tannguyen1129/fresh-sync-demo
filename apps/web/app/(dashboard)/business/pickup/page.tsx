'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle2, Clock, MapPin, ArrowRight, Container, ShieldCheck, Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/common/PageHeader';
import { PageContainer } from '@/components/common/PageContainer'; // Import mới
import { cn } from '@/lib/utils';

const STEPS = [{ id: 1, title: "Container Details" }, { id: 2, title: "AI Analysis" }, { id: 3, title: "Confirmation" }];

export default function CreatePickupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ containerId: '', requestedTime: '', priority: false });
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/business/pickup-requests', {
        containerId: formData.containerId,
        requestedTime: formData.requestedTime ? new Date(formData.requestedTime).toISOString() : undefined,
        priority: formData.priority
      });
      setResult(data);
      setStep(2);
      toast.success("AI Analysis Complete");
    } catch (err: any) {
      if (err.response?.status === 409) toast.error("Commercial Hold", { description: err.response.data.message });
      else if (err.response?.status === 404) toast.error("Container Not Found");
      else toast.error("Error", { description: "Failed to process request." });
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await api.post(`/business/bookings/${result.request.id}/confirm`, {
        requestId: result.request.id,
        slotStart: result.recommendation.slotStart,
        slotEnd: result.recommendation.slotEnd
      });
      setStep(3);
      toast.success("Booking Confirmed");
    } catch (err: any) { toast.error("Confirmation Failed", { description: err.response?.data?.message }); } 
    finally { setLoading(false); }
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="New Pickup Request" subtitle="Schedule a container pickup from the port." />

      <div className="flex items-center justify-between px-10 mb-8">
        {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center relative z-10">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold transition-colors duration-300", step >= s.id ? "bg-primary border-primary text-primary-foreground" : "bg-background border-muted text-muted-foreground")}>
                    {step > s.id ? <CheckCircle2 className="w-6 h-6" /> : s.id}
                </div>
                <span className={cn("text-xs mt-2 font-medium", step >= s.id ? "text-primary" : "text-muted-foreground")}>{s.title}</span>
            </div>
        ))}
        <div className="absolute left-0 right-0 h-0.5 bg-muted -z-0 mx-auto w-[60%] translate-y-[-14px]">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((step - 1) / 2) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <Card>
            <CardHeader><CardTitle>Enter Cargo Details</CardTitle><CardDescription>Provide container information to check availability.</CardDescription></CardHeader>
            <form onSubmit={handleAnalyze}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Container ID</Label>
                        <div className="relative"><Container className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="e.g. CONT-001" className="pl-9" required value={formData.containerId} onChange={e => setFormData({...formData, containerId: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Requested Time (Optional)</Label><Input type="datetime-local" value={formData.requestedTime} onChange={e => setFormData({...formData, requestedTime: e.target.value})} /></div>
                        <div className="flex items-end pb-2">
                            <div className="flex items-center space-x-2 border p-3 rounded-md w-full bg-secondary/20"><Checkbox id="priority" checked={formData.priority} onCheckedChange={(c) => setFormData({...formData, priority: c as boolean})} /><Label htmlFor="priority" className="cursor-pointer font-medium">Mark as Priority / VIP</Label></div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="justify-end"><Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Analyze Availability</Button></CardFooter>
            </form>
        </Card>
      )}

      {step === 2 && result && (
        <Card className="border-primary/20 shadow-lg">
            <CardHeader className="bg-primary/5 border-b pb-4">
                <div className="flex justify-between items-start">
                    <div><CardTitle className="text-xl text-primary">Recommendation Found</CardTitle><CardDescription>Optimal slot based on port conditions.</CardDescription></div>
                    <div className={cn("flex flex-col items-center justify-center w-16 h-16 rounded-full border-4", result.recommendation.riskScore < 30 ? "border-green-500 bg-green-50 text-green-700" : result.recommendation.riskScore < 70 ? "border-yellow-500 bg-yellow-50 text-yellow-700" : "border-red-500 bg-red-50 text-red-700")}>
                        <span className="text-lg font-bold">{result.recommendation.riskScore}</span><span className="text-[10px] uppercase font-bold">Risk</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="flex items-center p-4 bg-muted/50 rounded-lg border border-dashed border-primary/30">
                    <Clock className="w-8 h-8 text-primary mr-4" />
                    <div><p className="text-sm font-medium text-muted-foreground uppercase">Confirmed Time Slot</p><div className="text-2xl font-bold tracking-tight">{new Date(result.recommendation.slotStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} <span className="mx-2 text-muted-foreground font-light">-</span> {new Date(result.recommendation.slotEnd).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div><p className="text-sm text-muted-foreground">{new Date(result.recommendation.slotStart).toDateString()}</p></div>
                </div>
                <div className="space-y-2"><h4 className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Analysis Report</h4><p className="text-sm text-muted-foreground bg-secondary/30 p-3 rounded-md italic">"{result.recommendation.explanation}"</p></div>
                <div className="space-y-2">
                     <h4 className="text-sm font-medium flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Suggested Route</h4>
                    <div className="relative pl-4 ml-2 border-l-2 border-muted space-y-4 py-2">
                        {result.recommendation.routeJson?.steps?.map((step: string, idx: number) => (
                            <div key={idx} className="relative"><div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background"></div><p className="text-sm">{step}</p></div>
                        ))}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-muted/20 flex justify-between"><Button variant="outline" onClick={() => setStep(1)}>Cancel</Button><Button onClick={handleConfirm} disabled={loading} className="w-40">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Booking"}</Button></CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card className="text-center py-10 border-green-200 bg-green-50/30">
            <CardContent className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4"><CheckCircle2 className="w-10 h-10 text-green-600" /></div>
                <h2 className="text-2xl font-bold text-green-800">Booking Confirmed!</h2>
                <div className="pt-6 flex gap-4"><Button variant="outline" onClick={() => { setStep(1); setFormData({containerId:'', requestedTime:'', priority:false}); setResult(null); }}>Create Another</Button><Button onClick={() => router.push('/business/bookings')}>View Bookings <ArrowRight className="ml-2 w-4 h-4" /></Button></div>
            </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
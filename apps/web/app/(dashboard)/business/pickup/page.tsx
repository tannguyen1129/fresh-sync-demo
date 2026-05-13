'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle2, Clock, MapPin, ArrowRight, Container, ShieldCheck, Loader2, AlertTriangle, XCircle, Dot, Truck, UserCircle2, Phone, ShipWheel, BrainCircuit, Sparkles } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { PageContainer } from '@/components/common/PageContainer';
import { cn } from '@/lib/utils';

const STEPS = [{ id: 1, title: "Container Details" }, { id: 2, title: "Triple Validation" }, { id: 3, title: "Confirmation" }];
const DEMO_CONTAINERS = ['CONT-001', 'CONT-005', 'CONT-007', 'CONT-008', 'CONT-010', 'CONT-011', 'CONT-013', 'CONT-014', 'CONT-016'];
const STATUS_TONES: Record<string, string> = {
  PASS: 'border-green-200 bg-green-50',
  WARN: 'border-yellow-200 bg-yellow-50',
  FAIL: 'border-red-200 bg-red-50',
};

export default function CreatePickupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);
  const [formData, setFormData] = useState({
    containerId: '',
    requestedTime: '',
    priority: false,
    cargoType: 'GENERAL_CARGO',
    truckPlate: '',
    driverName: '',
    driverPhone: '',
    terminalCode: 'TML-A',
  });
  const [result, setResult] = useState<any>(null);
  const [blockedResult, setBlockedResult] = useState<any>(null);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const { data } = await api.get('/meta/demo-data');
        setMeta(data);
      } catch (error) {
        console.error(error);
      }
    };
    loadMeta();
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setBlockedResult(null);
    setResult(null);
    try {
      const { data } = await api.post('/business/pickup-requests', {
        containerId: formData.containerId,
        requestedTime: formData.requestedTime ? new Date(formData.requestedTime).toISOString() : undefined,
        priority: formData.priority,
        cargoType: formData.cargoType,
        truckPlate: formData.truckPlate,
        driverName: formData.driverName,
        driverPhone: formData.driverPhone,
        terminalCode: formData.terminalCode,
      });
      setResult(data);
      setStep(2);
      toast.success("AI Analysis Complete");
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.validations) {
        setBlockedResult(err.response.data);
        setStep(2);
        toast.warning("Pickup blocked by validation rules");
      } else if (err.response?.status === 404) {
        toast.error("Container Not Found");
      } else {
        toast.error("Error", { description: "Failed to process request." });
      }
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/business/bookings/${result.request.id}/confirm`, {
        requestId: result.request.id,
        slotStart: result.recommendation.slotStart,
        slotEnd: result.recommendation.slotEnd
      });
      setConfirmedBooking(data.booking);
      setStep(3);
      toast.success("Booking Confirmed");
    } catch (err: any) { toast.error("Confirmation Failed", { description: err.response?.data?.message }); } 
    finally { setLoading(false); }
  };

  const analysisPayload = result ?? blockedResult;
  const v = analysisPayload?.validations;
  const commercialLayers = v?.commercial
    ? [
        { key: 'do', title: 'Delivery Order', ...v.commercial.deliveryOrder },
        { key: 'customs', title: 'Customs Clearance', ...v.commercial.customs },
        { key: 'cargo', title: 'Cargo Classification', ...v.commercial.cargo },
      ]
    : [];
  const yardLayers = v?.yard
    ? [
        { key: 'location', title: 'Container Location', ...v.yard.location },
        { key: 'availability', title: 'Container Availability', ...v.yard.availability },
        { key: 'equipment', title: 'Yard Equipment', ...v.yard.equipment },
        { key: 'access', title: 'Yard Accessibility', ...v.yard.access },
      ]
    : [];
  const gateLayer = v?.gate
    ? { title: 'Gate Capacity Window', ...v.gate }
    : null;
  const isBlocked = Boolean(blockedResult);
  const riskFactors = result?.recommendation?.riskFactors ?? [];
  const validationTrace = result?.recommendation?.validationTrace;
  const priorityScore = result?.priorityScore;
  const cargoType = v?.cargoType ?? result?.cargoType;

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="New Pickup Request" subtitle="Schedule a container pickup from the port." />

      <Card className="border bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_42%,_#f8fafc_85%)]">
        <CardContent className="grid gap-4 p-5 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">AI Booking Engine</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight">FreshSync decides before the truck moves</h2>
            <p className="mt-2 text-sm text-slate-600">
              The engine checks commercial release, container readiness, gate pressure, yard load, and scenario risk before it commits a slot.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mandatory checks</div>
              <div className="mt-2 text-3xl font-black tracking-tight">3</div>
              <div className="mt-1 text-sm text-muted-foreground">Commercial, readiness, gate capacity</div>
            </div>
            <div className="rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Decision style</div>
              <div className="mt-2 text-lg font-bold">Explainable AI</div>
              <div className="mt-1 text-sm text-muted-foreground">Risk factors and trace visible to business users</div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                        <div className="flex flex-wrap gap-2 pt-2">
                          {DEMO_CONTAINERS.map((containerNo) => (
                            <Button key={containerNo} type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, containerId: containerNo })}>
                              {containerNo}
                            </Button>
                          ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Requested Time (Optional)</Label><Input type="datetime-local" value={formData.requestedTime} onChange={e => setFormData({...formData, requestedTime: e.target.value})} /></div>
                        <div className="flex items-end pb-2">
                            <div className="flex items-center space-x-2 border p-3 rounded-md w-full bg-secondary/20"><Checkbox id="priority" checked={formData.priority} onCheckedChange={(c) => setFormData({...formData, priority: c as boolean})} /><Label htmlFor="priority" className="cursor-pointer font-medium">Mark as Priority / VIP</Label></div>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Terminal</Label>
                        <div className="relative">
                          <ShipWheel className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={formData.terminalCode} onChange={(e) => setFormData({ ...formData, terminalCode: e.target.value })} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(meta?.terminals ?? []).map((terminal: any) => (
                            <Button key={terminal.code} type="button" variant="outline" size="sm" onClick={() => setFormData((prev) => ({ ...prev, terminalCode: terminal.code }))}>
                              {terminal.code}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo Type</Label>
                        <Input value={formData.cargoType} onChange={(e) => setFormData({ ...formData, cargoType: e.target.value })} placeholder="GENERAL_CARGO / REEFER_FOOD" />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Truck Plate</Label>
                        <div className="relative">
                          <Truck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={formData.truckPlate} onChange={(e) => setFormData({ ...formData, truckPlate: e.target.value })} placeholder="51C-123.45" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Driver</Label>
                        <div className="relative">
                          <UserCircle2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={formData.driverName} onChange={(e) => setFormData({ ...formData, driverName: e.target.value })} placeholder="Nguyen Van A" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={formData.driverPhone} onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })} placeholder="0901234567" />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Demo Fleet Shortcuts</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(meta?.drivers ?? []).slice(0, 4).map((driver: any) => (
                          <Button
                            key={driver.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData((prev) => ({
                              ...prev,
                              truckPlate: driver.licensePlate,
                              driverName: driver.name,
                              driverPhone: driver.phone,
                            }))}
                          >
                            {driver.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                </CardContent>
                <CardFooter className="justify-end"><Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Analyze Availability</Button></CardFooter>
            </form>
        </Card>
      )}

      {step === 2 && analysisPayload && (
        <Card className={cn("shadow-lg", isBlocked ? "border-red-300" : "border-primary/20")}>
            <CardHeader className={cn("border-b pb-4", isBlocked ? "bg-red-50" : "bg-primary/5")}>
                <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className={cn("text-xl", isBlocked ? "text-red-700" : "text-primary")}>
                        {isBlocked ? 'Pickup Blocked' : 'Recommendation Found'}
                      </CardTitle>
                      <CardDescription>
                        {isBlocked ? 'Validation explains why the job cannot be scheduled yet.' : 'Optimal slot based on port conditions.'}
                      </CardDescription>
                    </div>
                    <div className={cn("flex flex-col items-center justify-center w-16 h-16 rounded-full border-4", isBlocked ? "border-red-500 bg-red-50 text-red-700" : result.recommendation.riskScore < 30 ? "border-green-500 bg-green-50 text-green-700" : result.recommendation.riskScore < 70 ? "border-yellow-500 bg-yellow-50 text-yellow-700" : "border-red-500 bg-red-50 text-red-700")}>
                        <span className="text-lg font-bold">{isBlocked ? 'RED' : result.recommendation.riskScore}</span><span className="text-[10px] uppercase font-bold">{isBlocked ? 'State' : 'Risk'}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <ShieldCheck className={cn("w-4 h-4", isBlocked ? "text-red-600" : "text-primary")} />
                    Triple Validation
                    <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wide">SRS §1</Badge>
                  </h4>

                  <ValidationGroup
                    title="① Commercial Readiness"
                    subtitle="D/O status, customs clearance, cargo classification"
                    status={v?.commercial?.status}
                    detail={v?.commercial?.detail}
                    layers={commercialLayers}
                    footer={
                      cargoType ? (
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline">Cargo {cargoType}</Badge>
                          <Badge variant="outline">Soft quota {Math.round((v?.softQuota ?? 0) * 100)}%</Badge>
                          <Badge variant="outline">Urgency × {v?.urgencyWeight ?? 1}</Badge>
                        </div>
                      ) : null
                    }
                  />

                  <ValidationGroup
                    title="② Yard Readiness"
                    subtitle="Location, availability, equipment, access"
                    status={v?.yard?.status}
                    detail={v?.yard?.detail}
                    layers={yardLayers}
                  />

                  <div className={cn("rounded-lg border p-4", STATUS_TONES[(gateLayer?.status as string) ?? 'PASS'])}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">③ Gate Capacity</div>
                        <p className="mt-1 text-sm font-semibold">{gateLayer?.label ?? 'Gate window'}</p>
                        <p className="text-xs text-muted-foreground mt-1">{gateLayer?.detail}</p>
                        {gateLayer ? (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
                            <span className="rounded-full bg-white/80 px-2 py-0.5 border">
                              Utilization {gateLayer.utilizationPct ?? 0}%
                            </span>
                            <span className="rounded-full bg-white/80 px-2 py-0.5 border">
                              Available {gateLayer.availableSlots ?? 0} slots
                            </span>
                            {gateLayer.cargoQuotaCap ? (
                              <span className="rounded-full bg-white/80 px-2 py-0.5 border">
                                {cargoType} quota {gateLayer.cargoQuotaUsed}/{gateLayer.cargoQuotaCap}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="pt-0.5">
                        {gateLayer?.status === 'FAIL' ? <XCircle className="h-5 w-5 text-red-600" /> : gateLayer?.status === 'WARN' ? <AlertTriangle className="h-5 w-5 text-yellow-600" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      </div>
                    </div>
                  </div>

                  {priorityScore ? (
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Dynamic Priority Score: {priorityScore.score.toFixed(2)}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-slate-600">
                        <PriorityRow label="Cargo Urgency" value={priorityScore.breakdown.cargoUrgency} />
                        <PriorityRow label="Waiting Pressure" value={priorityScore.breakdown.waitPressure} />
                        <PriorityRow label="Deadline Risk" value={priorityScore.breakdown.deadlineRisk} />
                        <PriorityRow label="Resource Constraint" value={priorityScore.breakdown.resourceWeight} />
                        <PriorityRow label="Backlog Pressure" value={priorityScore.breakdown.backlogWeight} />
                        <PriorityRow label="Priority Flag" value={priorityScore.breakdown.priorityFlag} />
                      </div>
                    </div>
                  ) : null}
                </div>

                {!isBlocked && result && (
                  <>
                    <div className="flex items-center p-4 bg-muted/50 rounded-lg border border-dashed border-primary/30">
                        <Clock className="w-8 h-8 text-primary mr-4" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground uppercase">Recommended Time Slot</p>
                          <div className="text-2xl font-bold tracking-tight">{new Date(result.recommendation.slotStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} <span className="mx-2 text-muted-foreground font-light">-</span> {new Date(result.recommendation.slotEnd).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          <p className="text-sm text-muted-foreground">{new Date(result.recommendation.slotStart).toDateString()}</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> AI Explanation</h4>
                      <p className="text-sm text-muted-foreground bg-secondary/30 p-3 rounded-md italic">"{result.recommendation.explanation}"</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{formData.terminalCode}</Badge>
                        <Badge variant="outline">Gate {result.recommendation.assignedGate || result.recommendation.routeJson?.gate}</Badge>
                        <Badge variant="outline">{result.recommendation.routeJson?.yardZone}</Badge>
                        <Badge variant="outline">{result.recommendation.routeJson?.distanceKm} km</Badge>
                        <Badge variant="outline">Wait {result.recommendation.predictedWaitMin || result.recommendation.routeJson?.etaToGateMinutes} min</Badge>
                        <Badge variant="outline">ETA to gate {result.recommendation.routeJson?.etaToGateMinutes} min</Badge>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <BrainCircuit className="h-4 w-4 text-primary" />
                          Risk Factors
                        </div>
                        <div className="space-y-2">
                          {riskFactors.map((factor: any) => (
                            <div key={factor.factor} className="rounded-lg border bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold">{factor.factor.replace(/_/g, ' ')}</span>
                                <Badge variant={factor.impact > 0 ? 'outline' : 'secondary'}>
                                  {factor.impact > 0 ? `+${factor.impact}` : factor.impact}
                                </Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">{factor.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Decision Trace
                        </div>
                        <div className="space-y-2">
                          <TraceRow label="Gate Capacity" value={validationTrace?.gateCapacity || 'N/A'} />
                          <TraceRow label="Utilization" value={validationTrace?.utilizationPct != null ? `${validationTrace.utilizationPct}%` : 'N/A'} />
                          <TraceRow label="Yard Zone" value={validationTrace?.yardZone || 'N/A'} />
                          <TraceRow label="Disruptions" value={`${validationTrace?.disruptionCount ?? 0}`} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                         <h4 className="text-sm font-medium flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Suggested Route</h4>
                        <div className="relative pl-4 ml-2 border-l-2 border-muted space-y-4 py-2">
                            {result.recommendation.routeJson?.steps?.map((routeStep: string, idx: number) => (
                                <div key={idx} className="relative"><div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background"></div><p className="text-sm">{routeStep}</p></div>
                            ))}
                        </div>
                    </div>
                  </>
                )}
            </CardContent>
            <CardFooter className="bg-muted/20 flex justify-between">
              <Button variant="outline" onClick={() => { setStep(1); setBlockedResult(null); }}>
                {isBlocked ? 'Try Another Container' : 'Back'}
              </Button>
              {isBlocked ? (
                <div className="flex items-center text-sm font-medium text-red-600">
                  <Dot className="h-5 w-5" />
                  {blockedResult?.reason?.replace(/_/g, ' ')}
                </div>
              ) : (
                <Button onClick={handleConfirm} disabled={loading} className="w-40">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Booking"}</Button>
              )}
            </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card className="text-center py-10 border-green-200 bg-green-50/30">
            <CardContent className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4"><CheckCircle2 className="w-10 h-10 text-green-600" /></div>
                <h2 className="text-2xl font-bold text-green-800">Booking Confirmed!</h2>
                <div className="rounded-xl border border-green-200 bg-white px-6 py-4 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Booking Code</p>
                  <p className="text-lg font-bold">{confirmedBooking?.bookingCode || 'FreshSync booking created'}</p>
                  <p className="mt-2 text-sm text-muted-foreground">QR token is ready for driver check-in and visible in the driver workflow.</p>
                </div>
                <div className="pt-6 flex gap-4"><Button variant="outline" onClick={() => { setStep(1); setFormData({containerId:'', requestedTime:'', priority:false, cargoType:'GENERAL_CARGO', truckPlate:'', driverName:'', driverPhone:'', terminalCode:'TML-A'}); setResult(null); setConfirmedBooking(null); }}>Create Another</Button><Button onClick={() => router.push('/business/bookings')}>View Bookings <ArrowRight className="ml-2 w-4 h-4" /></Button></div>
            </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ValidationGroup({
  title,
  subtitle,
  status,
  detail,
  layers,
  footer,
}: {
  title: string;
  subtitle: string;
  status?: string;
  detail?: string;
  layers: Array<{ key: string; title: string; status?: string; label?: string; detail?: string }>;
  footer?: React.ReactNode;
}) {
  const tone = status === 'FAIL' ? 'red' : status === 'WARN' ? 'amber' : 'emerald';
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        tone === 'red' && 'border-red-200 bg-red-50/60',
        tone === 'amber' && 'border-amber-200 bg-amber-50/60',
        tone === 'emerald' && 'border-emerald-200 bg-emerald-50/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
          <div className="text-sm font-semibold mt-1">{detail || subtitle}</div>
        </div>
        <div className="pt-0.5">
          {status === 'FAIL' ? (
            <XCircle className="h-5 w-5 text-red-600" />
          ) : status === 'WARN' ? (
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {layers.map((layer) => (
          <div
            key={layer.key}
            className={cn(
              'rounded-lg border p-3 text-xs',
              layer.status === 'FAIL' ? 'border-red-200 bg-white' : layer.status === 'WARN' ? 'border-amber-200 bg-white' : 'border-emerald-200 bg-white',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm">{layer.title}</span>
              {layer.status === 'FAIL' ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : layer.status === 'WARN' ? (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
            </div>
            <p className="mt-1 text-xs font-medium">{layer.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{layer.detail}</p>
          </div>
        ))}
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

function PriorityRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
      <span>{label}</span>
      <span className="font-medium">{Number(value ?? 0).toFixed(2)}</span>
    </div>
  );
}

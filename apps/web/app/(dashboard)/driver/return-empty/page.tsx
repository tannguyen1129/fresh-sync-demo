'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Truck, MapPin, Navigation, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/common/PageContainer';

// --- Tách logic dùng searchParams ra component con ---
function ReturnEmptyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');

  const [analyzing, setAnalyzing] = useState(true);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (assignmentId) {
        // Giả lập delay AI analyze
        setTimeout(() => handleAnalyze(), 1500);
    }
  }, [assignmentId]);

  const handleAnalyze = async () => {
    try {
        const { data } = await api.post('/driver/return-empty', {
            assignmentId,
            currentLat: 10.845, currentLng: 106.810
        });
        setResult(data);
    } catch (e) {
        console.error(e);
    } finally {
        setAnalyzing(false);
    }
  };

  const handleStartReturn = () => {
      router.push('/driver/dashboard');
  };

  if (!assignmentId) return <div>Missing assignment ID</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 max-w-md mx-auto justify-center">
      {analyzing ? (
        <div className="text-center space-y-6">
            <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                <Truck className="absolute inset-0 m-auto text-primary w-8 h-8" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800">Finding Best Depot...</h2>
                <p className="text-slate-500">Analyzing traffic and capacity.</p>
            </div>
        </div>
      ) : result ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-900">Best Option Found</h1>
                <p className="text-slate-500">Optimized for shortest wait time.</p>
            </div>

            <Card className="border-green-500 border-2 shadow-xl overflow-hidden">
                <div className="bg-green-500 p-4 text-white flex justify-between items-center">
                    <span className="font-bold flex items-center"><MapPin className="mr-2 w-5 h-5"/> Recommended</span>
                    <Badge variant="secondary" className="bg-white/20 text-white border-none hover:bg-white/30">
                        {result.recommendation.distance.toFixed(1)} km
                    </Badge>
                </div>
                <CardContent className="p-6 text-center space-y-4">
                    <div className="text-4xl font-black text-slate-800 tracking-tight">
                        {result.recommendation.depotName}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-slate-100 p-3 rounded-lg">
                            <p className="text-slate-500">Traffic</p>
                            <p className="font-bold text-green-600">Light</p>
                        </div>
                        <div className="bg-slate-100 p-3 rounded-lg">
                            <p className="text-slate-500">Est. Time</p>
                            <p className="font-bold text-slate-900">15 min</p>
                        </div>
                    </div>

                    <div className="bg-green-50 p-3 rounded-lg text-green-700 text-sm italic">
                        "{result.recommendation.reason}"
                    </div>
                </CardContent>
            </Card>

            <Button onClick={handleStartReturn} className="w-full h-14 text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700">
                Navigate to Depot <ArrowRight className="ml-2 w-6 h-6" />
            </Button>
            
            <Button variant="ghost" className="w-full text-slate-500">
                View other options
            </Button>
        </div>
      ) : (
        <div className="text-center text-red-500">Failed to analyze route.</div>
      )}
    </div>
  );
}

// --- Component cha bọc Suspense ---
export default function ReturnEmptyPage() {
  return (
    <PageContainer>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading parameters...</div>}>
        <ReturnEmptyContent />
      </Suspense>
    </PageContainer>
  );
}
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Zap, Anchor, Truck, AlertOctagon } from 'lucide-react';

export default function IntegrationPlayground() {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const simulate = async (endpoint: string, payload: any, name: string) => {
    setLoading(true);
    try {
        await api.post(endpoint, payload);
        addLog(`✅ Triggered: ${name}`);
    } catch (e: any) {
        addLog(`❌ Failed: ${name} - ${e.response?.data?.message || e.message}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
       <h1 className="text-2xl font-bold text-gray-900 flex items-center">
           <Zap className="w-6 h-6 text-yellow-500 mr-2" />
           Integration Playground
       </h1>
       <p className="text-gray-500">Simulate external pushes from Shipping Lines and TOS.</p>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Shipping Line Simulations */}
           <div className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4">
               <h3 className="font-bold text-blue-800 flex items-center">
                   <Anchor className="w-5 h-5 mr-2" /> Shipping Line System
               </h3>
               
               <div className="space-y-2">
                   <button 
                       disabled={loading}
                       onClick={() => simulate('/integrations/shippingline/delivery-orders', { 
                           containerNo: 'CONT-001', status: 'HOLD' 
                       }, 'Push D/O HOLD (CONT-001)')}
                       className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded text-blue-700 text-sm font-medium border border-blue-200"
                   >
                       👉 Push D/O HOLD (Trigger UC2 Block)
                   </button>

                   <button 
                       disabled={loading}
                       onClick={() => simulate('/integrations/shippingline/delivery-orders', { 
                           containerNo: 'CONT-001', status: 'RELEASED' 
                       }, 'Push D/O RELEASED (CONT-001)')}
                       className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded text-blue-700 text-sm font-medium border border-blue-200"
                   >
                       👉 Push D/O RELEASED
                   </button>

                   <button 
                       disabled={loading}
                       onClick={() => simulate('/integrations/shippingline/vessels', { 
                           vesselCode: 'VSL-001', newEta: new Date(Date.now() + 5*3600*1000).toISOString() 
                       }, 'Push Vessel Delay (+5h)')}
                       className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded text-blue-700 text-sm font-medium border border-blue-200"
                   >
                       👉 Push Vessel Delay (Trigger Re-calc CRT)
                   </button>
               </div>
           </div>

           {/* TOS Simulations */}
           <div className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4">
               <h3 className="font-bold text-orange-800 flex items-center">
                   <Truck className="w-5 h-5 mr-2" /> TOS (Terminal Operating System)
               </h3>
               
               <div className="space-y-2">
                   <button 
                       disabled={loading}
                       onClick={() => simulate('/integrations/tos/disruptions', { 
                           type: 'CRANE_BREAKDOWN', 
                           severity: 'HIGH',
                           startTime: new Date().toISOString(),
                           affectedZones: ['ZONE_A'],
                           description: 'Main Crane 01 Hydraulic Failure'
                       }, 'Report Crane Breakdown (Zone A)')}
                       className="w-full text-left px-4 py-2 bg-orange-50 hover:bg-orange-100 rounded text-orange-700 text-sm font-medium border border-orange-200"
                   >
                       👉 Report Crane Breakdown (Trigger UC3 Re-optimize)
                   </button>

                   <button 
                       disabled={loading}
                       onClick={() => simulate('/integrations/tos/disruptions', { 
                           type: 'GATE_CONGESTION', 
                           severity: 'MEDIUM',
                           startTime: new Date().toISOString(),
                           affectedZones: ['GATE_1'],
                           description: 'Long queue at Gate 1'
                       }, 'Report Gate Congestion')}
                       className="w-full text-left px-4 py-2 bg-orange-50 hover:bg-orange-100 rounded text-orange-700 text-sm font-medium border border-orange-200"
                   >
                       👉 Report Gate Congestion
                   </button>
               </div>
           </div>
       </div>

       {/* Logs */}
       <div className="bg-gray-900 rounded-lg p-4 text-xs font-mono text-green-400 h-48 overflow-y-auto">
           {log.length === 0 ? <span className="text-gray-500">// Waiting for simulation events...</span> : log.map((l, i) => (
               <div key={i}>{l}</div>
           ))}
       </div>
    </div>
  );
}
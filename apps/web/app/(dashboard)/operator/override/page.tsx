'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { ShieldAlert, Lock } from 'lucide-react';

export default function OverridePage() {
  const [targetType, setTargetType] = useState('CONTAINER');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { data } = await api.post('/operator/override/block', {
          targetType,
          targetId,
          reason
      });
      setMessage(`✅ Success: ${data.message}`);
      setTargetId('');
      setReason('');
    } catch (e: any) {
        setMessage(`❌ Error: ${e.response?.data?.message || 'Failed'}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Manual Override Operations</h1>
      
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
         <div className="flex items-center mb-6 text-red-700 bg-red-50 p-3 rounded">
            <ShieldAlert className="w-6 h-6 mr-3" />
            <div>
                <p className="font-bold">Emergency Block / Hold</p>
                <p className="text-sm">This action will trigger immediate re-optimization for all impacted bookings.</p>
            </div>
         </div>

         <form onSubmit={handleBlock} className="space-y-4">
             <div>
                 <label className="block text-sm font-medium text-gray-700">Target Type</label>
                 <select 
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}
                 >
                     <option value="CONTAINER">Container (Commercial Hold)</option>
                     <option value="ZONE">Yard Zone (Maintenance/Incident)</option>
                     <option value="GATE">Gate (Congestion/Close)</option>
                 </select>
             </div>

             <div>
                 <label className="block text-sm font-medium text-gray-700">Target ID</label>
                 <input 
                    type="text" 
                    required
                    placeholder={targetType === 'CONTAINER' ? 'e.g., CONT-001' : 'e.g., ZONE_A'}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                 />
             </div>

             <div>
                 <label className="block text-sm font-medium text-gray-700">Reason</label>
                 <input 
                    type="text" 
                    required
                    placeholder="e.g., Unpaid fees, Crane breakdown, Urgent maintenance"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                 />
             </div>

             <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
             >
                <Lock className="w-4 h-4 mr-2" />
                {loading ? 'Processing...' : 'Apply Block'}
             </button>
         </form>

         {message && <div className="mt-4 p-3 bg-gray-50 rounded text-sm font-medium">{message}</div>}
      </div>
    </div>
  );
}
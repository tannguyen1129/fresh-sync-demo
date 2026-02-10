'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function IncidentsPage() {
  const [impacted, setImpacted] = useState<any[]>([]);
  
  const fetchImpacted = async () => {
    try {
      const { data } = await api.get('/operator/monitor/impacted');
      setImpacted(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchImpacted(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Incidents & Impact Analysis</h1>
        <button onClick={fetchImpacted} className="flex items-center text-sm text-blue-600">
            <RefreshCcw className="w-4 h-4 mr-1" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="p-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-700">Recently Impacted Bookings</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Container</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {impacted.map((booking) => (
              <tr key={booking.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{booking.request.container.containerNo}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.request.company.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                       booking.status === 'BLOCKED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                   }`}>
                       {booking.status}
                   </span>
                </td>
                <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate" title={booking.blockedReason}>
                    {booking.blockedReason}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(booking.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {impacted.length === 0 && <div className="p-4 text-center text-gray-500">No recent impacts recorded.</div>}
      </div>
    </div>
  );
}
'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';

export default function CapacityPage() {
    const [formData, setFormData] = useState({
        date: '',
        startHour: 8,
        slots: 100
    });
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const start = new Date(`${formData.date}T${String(formData.startHour).padStart(2,'0')}:00:00`);
        const end = new Date(start.getTime() + 60*60*1000);
        
        try {
            await api.post('/operator/capacity/gate', {
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                maxSlots: Number(formData.slots)
            });
            alert('Capacity Added');
        } catch (e) { alert('Failed'); }
    };

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Gate Capacity Editor</h1>
            <div className="bg-white p-6 rounded shadow">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Date</label>
                        <input type="date" required className="border w-full p-2 rounded" 
                            onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Start Hour (0-23)</label>
                        <input type="number" min="0" max="23" required className="border w-full p-2 rounded"
                            value={formData.startHour}
                            onChange={e => setFormData({...formData, startHour: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Max Slots</label>
                        <input type="number" required className="border w-full p-2 rounded"
                             value={formData.slots}
                             onChange={e => setFormData({...formData, slots: Number(e.target.value)})} />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded flex justify-center items-center">
                        <Plus className="w-4 h-4 mr-2" /> Add Capacity Slot
                    </button>
                </form>
            </div>
        </div>
    );
}
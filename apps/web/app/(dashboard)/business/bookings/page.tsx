'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS, BookingUpdatedPayload } from '@freshsync/shared';
import { RefreshCw, MoreHorizontal, Eye, Ban, Calendar, Clock, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PageContainer } from '@/components/common/PageContainer'; // Import mới
import { toast } from 'sonner';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState("ALL");

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/business/bookings');
      setBookings(data);
    } catch (e) { toast.error("Failed to load bookings"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBookings(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on(EVENTS.BOOKING_UPDATED, (payload: BookingUpdatedPayload) => {
      setBookings((prev) => 
        prev.map((b) => 
          b.id === payload.bookingId 
            ? { ...b, status: payload.newStatus, confirmedSlotStart: payload.slotStart, confirmedSlotEnd: payload.slotEnd, blockedReason: payload.reason } 
            : b
        )
      );
      toast.info(`Booking Updated`, { description: `Status changed to ${payload.newStatus}` });
    });
    return () => { socket.off(EVENTS.BOOKING_UPDATED); };
  }, [socket]);

  const filteredBookings = bookings.filter(b => {
    if (activeTab === "ALL") return true;
    if (activeTab === "ISSUES") return ["BLOCKED", "RESCHEDULED", "CANCELLED"].includes(b.status);
    return b.status === activeTab;
  });

  return (
    <PageContainer>
      <PageHeader 
        title="Booking Management" 
        subtitle="Track and manage your container pickup requests."
        actions={
            <Button variant="outline" size="sm" onClick={fetchBookings} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
        }
      />

      <Tabs defaultValue="ALL" className="w-full" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ALL">All Bookings</TabsTrigger>
          <TabsTrigger value="CONFIRMED">Confirmed</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          <TabsTrigger value="ISSUES" className="text-red-600 data-[state=active]:text-red-700">Needs Attention</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
            <Table>
                <TableHeader>
                    <TableRow><TableHead>Container</TableHead><TableHead>Slot Time</TableHead><TableHead>Status</TableHead><TableHead>Driver & Route</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? [...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell><TableCell><Skeleton className="h-4 w-40" /></TableCell><TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                            </TableRow>
                         )) : filteredBookings.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No bookings found for this filter.</TableCell></TableRow>
                    ) : filteredBookings.map((booking) => (
                            <TableRow key={booking.id}>
                                <TableCell><div className="font-medium">{booking.request.container.containerNo}</div><div className="text-xs text-muted-foreground">{booking.request.container.sizeType}</div></TableCell>
                                <TableCell>
                                    <div className="flex items-center text-sm"><Calendar className="mr-2 h-3 w-3 text-muted-foreground" />{new Date(booking.confirmedSlotStart).toLocaleDateString()}</div>
                                    <div className="flex items-center text-xs text-muted-foreground mt-1"><Clock className="mr-2 h-3 w-3" />{new Date(booking.confirmedSlotStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(booking.confirmedSlotEnd).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={booking.status} />
                                    {booking.blockedReason && <div className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={booking.blockedReason}>{booking.blockedReason}</div>}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center text-sm"><Truck className="mr-2 h-3 w-3 text-muted-foreground" />{booking.assignment?.driver?.name || 'Pending assignment...'}</div>
                                    <div className="text-xs text-muted-foreground mt-1 pl-5 truncate max-w-[200px]">{booking.assignment?.routeJson?.steps?.join(' → ')}</div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" aria-label="Menu"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                            {['CONFIRMED', 'RESCHEDULED'].includes(booking.status) && <DropdownMenuItem className="text-red-600"><Ban className="mr-2 h-4 w-4" /> Cancel Booking</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                </TableBody>
            </Table>
        </Card>
      </Tabs>
    </PageContainer>
  );
}
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS, BookingUpdatedPayload, DriverAssignmentPayload } from '@freshsync/shared';
import { RefreshCw, MoreHorizontal, Eye, Ban, Calendar, Clock, Truck, QrCode, Route, ShieldCheck } from 'lucide-react';
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
    socket.on(EVENTS.DRIVER_ASSIGNMENT_CREATED, (payload: DriverAssignmentPayload) => {
      setBookings((prev) =>
        prev.map((booking) =>
          booking.id === payload.bookingId
            ? {
                ...booking,
                assignments: [
                  ...(booking.assignments ?? []).filter((assignment: any) => assignment.id !== payload.assignmentId),
                  {
                    id: payload.assignmentId,
                    bookingId: booking.id,
                    type: payload.type,
                    status: payload.status,
                    driver: payload.driverName || payload.licensePlate
                      ? {
                          name: payload.driverName,
                          licensePlate: payload.licensePlate,
                        }
                      : null,
                    routeJson: {
                      steps: [payload.location.name],
                    },
                    updatedAt: payload.updatedAt ?? new Date().toISOString(),
                  },
                ],
              }
            : booking
        )
      );
    });
    socket.on(EVENTS.DRIVER_ASSIGNMENT_UPDATED, (payload: DriverAssignmentPayload) => {
      setBookings((prev) =>
        prev.map((booking) => ({
          ...booking,
          assignments: booking.assignments?.map((assignment: any) =>
            assignment.id === payload.assignmentId
              ? { ...assignment, status: payload.status }
              : assignment
          ),
        }))
      );
    });
    return () => {
      socket.off(EVENTS.BOOKING_UPDATED);
      socket.off(EVENTS.DRIVER_ASSIGNMENT_CREATED);
      socket.off(EVENTS.DRIVER_ASSIGNMENT_UPDATED);
    };
  }, [socket]);

  const filteredBookings = bookings.filter(b => {
    if (activeTab === "ALL") return true;
    if (activeTab === "ISSUES") return ["BLOCKED", "RESCHEDULED", "CANCELLED"].includes(b.status);
    return b.status === activeTab;
  });

  const getPrimaryAssignment = (booking: any) =>
    booking.assignments?.find((assignment: any) => assignment.type === 'PICKUP') ??
    booking.assignments?.[0];

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

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="rounded-2xl border bg-[radial-gradient(circle_at_top,_#dbeafe,_#eff6ff_45%,_#f8fafc_85%)] p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryItem
                label="Confirmed Slots"
                value={bookings.filter((booking) => booking.status === 'CONFIRMED').length}
                description="AI-approved bookings ready for execution"
              />
              <SummaryItem
                label="Checked-in Trucks"
                value={bookings.filter((booking) => booking.checkInStatus === 'CHECKED_IN').length}
                description="Arrivals validated at the gate"
              />
              <SummaryItem
                label="Exception Cases"
                value={bookings.filter((booking) => ['BLOCKED', 'RESCHEDULED'].includes(booking.status)).length}
                description="Cases Ops may need to explain or adjust"
              />
            </div>
          </Card>

          <Card className="rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Demo Story</div>
                <div className="mt-2 text-lg font-bold">Business can now track the whole flow</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Booking code, slot, gate, driver, QR readiness, and live check-in are all visible from one screen.
                </div>
              </div>
              <QrCode className="h-9 w-9 text-primary" />
            </div>
          </Card>
        </div>

        <Card className="mt-4">
            <Table>
                <TableHeader>
                    <TableRow><TableHead>Booking</TableHead><TableHead>Slot & Gate</TableHead><TableHead>Status</TableHead><TableHead>Driver & Route</TableHead><TableHead>Checkpoint</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? [...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell><TableCell><Skeleton className="h-4 w-40" /></TableCell><TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                            </TableRow>
                         )) : filteredBookings.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No bookings found for this filter.</TableCell></TableRow>
                    ) : filteredBookings.map((booking) => {
                            const primaryAssignment = getPrimaryAssignment(booking);
                            return (
                            <TableRow key={booking.id}>
                                <TableCell>
                                  <div className="font-medium">{booking.bookingCode || 'Pending code'}</div>
                                  <div className="text-xs text-muted-foreground mt-1">{booking.request.container.containerNo}</div>
                                  <div className="text-xs text-muted-foreground">{booking.request.container.sizeType}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center text-sm"><Calendar className="mr-2 h-3 w-3 text-muted-foreground" />{new Date(booking.confirmedSlotStart).toLocaleDateString()}</div>
                                    <div className="flex items-center text-xs text-muted-foreground mt-1"><Clock className="mr-2 h-3 w-3" />{new Date(booking.confirmedSlotStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(booking.confirmedSlotEnd).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                    <div className="mt-2 inline-flex items-center rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                                      Gate {booking.assignedGate || 'TBD'} • {booking.terminalCode || 'TML-A'}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={booking.status} />
                                    {booking.blockedReason && <div className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={booking.blockedReason}>{booking.blockedReason}</div>}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center text-sm"><Truck className="mr-2 h-3 w-3 text-muted-foreground" />{primaryAssignment?.driver?.name || 'Pending assignment...'}</div>
                                    <div className="text-xs text-muted-foreground mt-1 pl-5">{primaryAssignment?.driver?.licensePlate || 'No plate yet'}</div>
                                    <div className="text-xs text-muted-foreground mt-1 pl-5 truncate max-w-[220px]">{primaryAssignment?.routeJson?.steps?.join(' → ')}</div>
                                    {primaryAssignment?.status && <div className="mt-2 pl-5"><StatusBadge status={primaryAssignment.status} /></div>}
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      <span>QR / Gate</span>
                                    </div>
                                    <StatusBadge status={booking.checkInStatus || 'PENDING'} />
                                    <div className="text-xs text-muted-foreground">
                                      {booking.checkInAt
                                        ? `Checked in at ${new Date(booking.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                        : 'Waiting for driver arrival'}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" aria-label="Menu"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem asChild>
                                              <Link href="/business/dashboard"><Eye className="mr-2 h-4 w-4" /> View Dashboard</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                              <Link href="/driver/qr"><Route className="mr-2 h-4 w-4" /> Open Driver QR Story</Link>
                                            </DropdownMenuItem>
                                            {['CONFIRMED', 'RESCHEDULED'].includes(booking.status) && <DropdownMenuItem className="text-red-600"><Ban className="mr-2 h-4 w-4" /> Cancel Booking</DropdownMenuItem>}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )})}
                </TableBody>
            </Table>
        </Card>
      </Tabs>
    </PageContainer>
  );
}

function SummaryItem({ label, value, description }: any) {
  return (
    <div className="rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{description}</div>
    </div>
  );
}

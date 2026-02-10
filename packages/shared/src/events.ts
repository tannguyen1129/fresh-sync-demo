// packages/shared/src/events.ts

import { BookingStatus, AssignmentStatus } from './enums';

export const EVENTS = {
  // Booking related
  BOOKING_UPDATED: 'booking.updated',
  
  // Disruption related
  DISRUPTION_CREATED: 'disruption.created',
  
  // Driver related
  DRIVER_ASSIGNMENT_CREATED: 'driver.assignment.created',
  DRIVER_ASSIGNMENT_UPDATED: 'driver.assignment.updated',
  
  // Operator Dashboard
  CONGESTION_UPDATED: 'dashboard.congestion.updated',
  
  // Notifications
  NOTIFICATION_CREATED: 'notification.created',
} as const;

// --- Event Payloads ---

export interface BookingUpdatedPayload {
  bookingId: string;
  requestId: string;
  newStatus: BookingStatus;
  reason?: string;
  slotStart?: string; // ISO
  slotEnd?: string;   // ISO
  containerNo: string;
}

export interface DisruptionCreatedPayload {
  id: string;
  type: string;
  severity: string;
  description: string;
  affectedZones: string[];
}

export interface DriverAssignmentPayload {
  assignmentId: string;
  type: 'PICKUP' | 'RETURN_EMPTY';
  containerNo: string;
  location: { name: string; lat: number; lng: number }; // Gate or Depot
  timeWindow: { start: string; end: string };
}

export interface CongestionUpdatePayload {
  timestamp: string;
  gateLoad: number; // %
  yardOccupancy: Record<string, number>; // { "ZONE_A": 80 }
  activeDisruptions: number;
}

export interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR';
  createdAt: string;
}
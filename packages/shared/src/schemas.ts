// packages/shared/src/schemas.ts

import { z } from 'zod';
import { 
  AssignmentStatus, 
  DisruptionType, 
  Severity, 
  DriverStatus, 
  DOStatus 
} from './enums';

// --- 1. Business: Pickup Request & Booking ---

export const CreatePickupRequestSchema = z.object({
  containerId: z.string().min(1, "Container ID is required"),
  requestedTime: z.string().datetime().optional(), // ISO String
  priority: z.boolean().default(false),
});

export type CreatePickupRequestDto = z.infer<typeof CreatePickupRequestSchema>;

export const ConfirmBookingSchema = z.object({
  requestId: z.string().uuid(),
  slotStart: z.string().datetime(),
  slotEnd: z.string().datetime(),
});

export type ConfirmBookingDto = z.infer<typeof ConfirmBookingSchema>;

// --- 2. Driver: Assignment Operations ---

export const UpdateAssignmentStatusSchema = z.object({
  status: z.nativeEnum(AssignmentStatus),
  lat: z.number().optional(),
  lng: z.number().optional(),
  note: z.string().optional(),
});

export type UpdateAssignmentStatusDto = z.infer<typeof UpdateAssignmentStatusSchema>;

export const StartReturnEmptySchema = z.object({
  assignmentId: z.string().uuid(),
  // Location hiện tại của tài xế để tính toán đường đi
  currentLat: z.number(),
  currentLng: z.number(),
});

export type StartReturnEmptyDto = z.infer<typeof StartReturnEmptySchema>;

// --- 3. Operator: Disruption Management ---

export const CreateDisruptionSchema = z.object({
  type: z.nativeEnum(DisruptionType),
  severity: z.nativeEnum(Severity),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  affectedZones: z.array(z.string()).min(1),
  description: z.string().min(5),
});

export type CreateDisruptionDto = z.infer<typeof CreateDisruptionSchema>;

// --- 4. UDP: Ingestion (Simulated External System) ---

export const IngestDOUpdateSchema = z.object({
  containerNo: z.string(),
  status: z.nativeEnum(DOStatus),
  validUntil: z.string().datetime().optional(),
});

export type IngestDOUpdateDto = z.infer<typeof IngestDOUpdateSchema>;

export const IngestVesselDelaySchema = z.object({
  vesselCode: z.string(),
  newEta: z.string().datetime(),
});

export type IngestVesselDelayDto = z.infer<typeof IngestVesselDelaySchema>;
// packages/shared/src/enums.ts

export enum DriverStatus {
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
}

export enum RequestStatus {
  CREATED = 'CREATED',
  VALIDATING = 'VALIDATING',
  RECOMMENDED = 'RECOMMENDED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  RESCHEDULED = 'RESCHEDULED',
  BLOCKED = 'BLOCKED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum AssignmentStatus {
  NEW = 'NEW',
  ENROUTE = 'ENROUTE',
  ARRIVED_GATE = 'ARRIVED_GATE',
  PICKED_UP = 'PICKED_UP',
  DEPARTED = 'DEPARTED',
  DELIVERED = 'DELIVERED',
  RETURN_EMPTY_STARTED = 'RETURN_EMPTY_STARTED',
  RETURNED = 'RETURNED',
}

export enum DisruptionType {
  CRANE_BREAKDOWN = 'CRANE_BREAKDOWN',
  GATE_CONGESTION = 'GATE_CONGESTION',
  VESSEL_DELAY = 'VESSEL_DELAY',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum DOStatus {
  HOLD = 'HOLD',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
  NOT_FOUND = 'NOT_FOUND',
}

export enum CustomsStatus {
  CLEARED = 'CLEARED',
  PENDING = 'PENDING',
  INSPECTION_REQUIRED = 'INSPECTION_REQUIRED',
  HOLD = 'HOLD',
}

export enum CargoType {
  DRY = 'DRY',
  REEFER = 'REEFER',
  OOG = 'OOG',
}

export enum ContainerYardStatus {
  LOCATED = 'LOCATED',
  NOT_LOCATED = 'NOT_LOCATED',
  BLOCKED = 'BLOCKED',
  READY = 'READY',
}

export enum ContainerAvailability {
  READY = 'READY',
  BLOCKED = 'BLOCKED',
  NOT_READY = 'NOT_READY',
  UNDER_OPERATION = 'UNDER_OPERATION',
}

export enum EquipmentStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum YardAccessStatus {
  ACCESSIBLE = 'ACCESSIBLE',
  CONGESTED = 'CONGESTED',
  BLOCKED = 'BLOCKED',
}

// Thêm cái này
export enum AssignmentType {
  PICKUP = 'PICKUP',
  RETURN_EMPTY = 'RETURN_EMPTY',
}
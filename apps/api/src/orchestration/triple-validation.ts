import {
  CargoType,
  ContainerAvailability,
  CustomsStatus,
  DOStatus,
} from '@prisma/client';

export type ValidationStatus = 'PASS' | 'WARN' | 'FAIL';

export interface ValidationLayer {
  status: ValidationStatus;
  label: string;
  detail: string;
  reasonCode?: string;
  meta?: Record<string, unknown>;
}

export interface CommercialValidation {
  status: ValidationStatus;
  label: string;
  detail: string;
  reasonCode?: string;
  deliveryOrder: ValidationLayer;
  customs: ValidationLayer;
  cargo: ValidationLayer;
  cargoType: CargoType;
}

export interface YardValidation {
  status: ValidationStatus;
  label: string;
  detail: string;
  reasonCode?: string;
  location: ValidationLayer;
  availability: ValidationLayer;
  equipment: ValidationLayer;
  access: ValidationLayer;
}

export interface GateValidation {
  status: ValidationStatus;
  label: string;
  detail: string;
  reasonCode?: string;
  slotStart?: Date;
  slotEnd?: Date;
  utilizationPct?: number;
  availableSlots?: number;
  congestionRisk?: number;
}

export interface TripleValidationResult {
  commercial: CommercialValidation;
  yard: YardValidation;
  gate: GateValidation;
  finalDecision: 'READY' | 'WAITING' | 'BLOCKED';
  blockedReason?: string;
}

// SRS-compliant cargo soft quota (Dry 60-70%, Reefer 20-25%, OOG 5-10%, buffer 5-10%)
export const CARGO_SOFT_QUOTA: Record<CargoType, number> = {
  DRY: 0.65,
  REEFER: 0.22,
  OOG: 0.08,
};

// Dry=1.0, Reefer=3.0, OOG=2.5 per logic doc
export const CARGO_URGENCY_WEIGHT: Record<CargoType, number> = {
  DRY: 1.0,
  REEFER: 3.0,
  OOG: 2.5,
};

export function resolveCargoType(input: {
  isReefer: boolean;
  isOog: boolean;
  cargoType?: string | null;
  hintFromRequest?: string | null;
}): CargoType {
  const hint = (input.hintFromRequest || input.cargoType || '').toUpperCase();
  if (hint.includes('REEFER') || input.isReefer) return CargoType.REEFER;
  if (hint.includes('OOG') || input.isOog) return CargoType.OOG;
  return CargoType.DRY;
}

export function validateCommercial(params: {
  doStatus: DOStatus | null;
  doValidUntil: Date | null;
  customsStatus: CustomsStatus | null;
  cargoType: CargoType;
  now: Date;
}): CommercialValidation {
  const { doStatus, doValidUntil, customsStatus, cargoType, now } = params;

  let deliveryOrder: ValidationLayer;
  if (!doStatus) {
    deliveryOrder = {
      status: 'FAIL',
      label: 'D/O Not Found',
      detail: 'No Delivery Order is registered for this container.',
      reasonCode: 'DO_NOT_FOUND',
    };
  } else if (doStatus === DOStatus.HOLD) {
    deliveryOrder = {
      status: 'FAIL',
      label: 'Commercial Hold',
      detail: 'Delivery Order is on HOLD — shipping line / commercial team must release before pickup.',
      reasonCode: 'COMMERCIAL_HOLD',
    };
  } else if (doStatus === DOStatus.EXPIRED || (doValidUntil && doValidUntil < now)) {
    deliveryOrder = {
      status: 'FAIL',
      label: 'D/O Expired',
      detail: `Delivery Order expired${doValidUntil ? ` at ${doValidUntil.toLocaleString()}` : ''}.`,
      reasonCode: 'DO_EXPIRED',
    };
  } else if (doStatus === DOStatus.NOT_FOUND) {
    deliveryOrder = {
      status: 'FAIL',
      label: 'D/O Not Found',
      detail: 'Shipping line returned NOT_FOUND for this container — manual review required.',
      reasonCode: 'DO_NOT_FOUND',
    };
  } else {
    deliveryOrder = {
      status: 'PASS',
      label: 'D/O Released',
      detail: `Delivery Order is released${doValidUntil ? ` until ${doValidUntil.toLocaleString()}` : '.'}`,
      reasonCode: 'DO_RELEASED',
    };
  }

  let customs: ValidationLayer;
  const cs = customsStatus ?? CustomsStatus.CLEARED;
  switch (cs) {
    case CustomsStatus.CLEARED:
      customs = { status: 'PASS', label: 'Customs Cleared', detail: 'Customs procedure has been completed.' };
      break;
    case CustomsStatus.PENDING:
      customs = {
        status: 'WARN',
        label: 'Customs Pending',
        detail: 'Customs paperwork is still being processed — request will be queued.',
        reasonCode: 'CUSTOMS_PENDING',
      };
      break;
    case CustomsStatus.INSPECTION_REQUIRED:
      customs = {
        status: 'WARN',
        label: 'Inspection Required',
        detail: 'Container requires physical inspection — schedule after inspection slot.',
        reasonCode: 'CUSTOMS_INSPECTION',
      };
      break;
    case CustomsStatus.HOLD:
      customs = {
        status: 'FAIL',
        label: 'Customs Hold',
        detail: 'Container is held by customs authority — pickup not allowed.',
        reasonCode: 'CUSTOMS_HOLD',
      };
      break;
  }

  const cargo: ValidationLayer = {
    status: 'PASS',
    label: `${cargoType} cargo classified`,
    detail:
      cargoType === CargoType.REEFER
        ? 'Reefer cargo: temperature-sensitive, eligible for priority queue.'
        : cargoType === CargoType.OOG
          ? 'OOG cargo: requires special equipment, slot must be reserved with OOG quota.'
          : 'Dry cargo: standard slot allocation applies.',
    meta: {
      cargoType,
      softQuota: CARGO_SOFT_QUOTA[cargoType],
      urgencyWeight: CARGO_URGENCY_WEIGHT[cargoType],
    },
  };

  const subStatuses: ValidationStatus[] = [deliveryOrder.status, customs.status, cargo.status];
  const overall: ValidationStatus = subStatuses.includes('FAIL')
    ? 'FAIL'
    : subStatuses.includes('WARN')
      ? 'WARN'
      : 'PASS';

  const reasonCode =
    deliveryOrder.status === 'FAIL'
      ? deliveryOrder.reasonCode
      : customs.status === 'FAIL'
        ? customs.reasonCode
        : customs.status === 'WARN'
          ? customs.reasonCode
          : undefined;

  return {
    status: overall,
    label:
      overall === 'PASS'
        ? 'Commercial ready'
        : overall === 'WARN'
          ? 'Commercial waiting'
          : 'Commercial blocked',
    detail:
      overall === 'PASS'
        ? 'Delivery order released, customs cleared, cargo classified.'
        : overall === 'WARN'
          ? 'Customs paperwork still in progress.'
          : 'A commercial / regulatory condition is failing.',
    reasonCode,
    deliveryOrder,
    customs,
    cargo,
    cargoType,
  };
}

export function validateYard(params: {
  containerStatus: string; // INCOMING | DISCHARGED | GATE_OUT | RETURNED
  availability: ContainerAvailability;
  yardZone: string | null;
  yardBlock: string | null;
  yardOccupancyPct: number;
  equipmentAvailable: boolean;
  equipmentBusyCount: number;
  cargoType: CargoType;
  specialEquipmentReady: boolean;
  crt: Date | null;
  now: Date;
}): YardValidation {
  const {
    containerStatus,
    availability,
    yardZone,
    yardBlock,
    yardOccupancyPct,
    equipmentAvailable,
    equipmentBusyCount,
    cargoType,
    specialEquipmentReady,
    crt,
    now,
  } = params;

  const located = yardZone != null && containerStatus !== 'INCOMING';
  const location: ValidationLayer = located
    ? {
        status: 'PASS',
        label: 'Container located',
        detail: `Container is positioned in ${yardZone}${yardBlock ? ` / ${yardBlock}` : ''}.`,
      }
    : {
        status: 'FAIL',
        label: 'Container not located',
        detail:
          containerStatus === 'INCOMING'
            ? 'Container is still on vessel — waiting for discharge to yard.'
            : 'Container yard position is not registered yet.',
        reasonCode: 'CONTAINER_NOT_LOCATED',
      };

  let availabilityLayer: ValidationLayer;
  switch (availability) {
    case ContainerAvailability.READY:
      availabilityLayer = {
        status: 'PASS',
        label: 'Container ready',
        detail: 'Container is available for pickup.',
      };
      break;
    case ContainerAvailability.BLOCKED:
      availabilityLayer = {
        status: 'FAIL',
        label: 'Container blocked',
        detail: 'Container is physically blocked by another stack — reschedule required.',
        reasonCode: 'CONTAINER_BLOCKED',
      };
      break;
    case ContainerAvailability.NOT_READY:
      availabilityLayer = {
        status: 'WARN',
        label: 'Container not ready',
        detail: crt
          ? `Container is being prepared — earliest readiness ${crt.toLocaleString()}.`
          : 'Container processing has not finished yet.',
        reasonCode: 'CONTAINER_NOT_READY',
      };
      break;
    case ContainerAvailability.UNDER_OPERATION:
      availabilityLayer = {
        status: 'WARN',
        label: 'Under operation',
        detail: 'Container is currently being handled by yard operations.',
        reasonCode: 'CONTAINER_UNDER_OPERATION',
      };
      break;
  }

  const equipment: ValidationLayer = !equipmentAvailable
    ? {
        status: 'FAIL',
        label: 'Equipment unavailable',
        detail: `No yard equipment is currently available (${equipmentBusyCount} busy).`,
        reasonCode: 'EQUIPMENT_UNAVAILABLE',
      }
    : cargoType === CargoType.OOG && !specialEquipmentReady
      ? {
          status: 'FAIL',
          label: 'OOG handler offline',
          detail: 'Out-of-gauge handler required for OOG cargo is not ready.',
          reasonCode: 'OOG_EQUIPMENT_MISSING',
        }
      : cargoType === CargoType.REEFER && !specialEquipmentReady
        ? {
            status: 'WARN',
            label: 'Reefer power tight',
            detail: 'Reefer power slots are limited — request will be re-evaluated.',
            reasonCode: 'REEFER_RESOURCE_TIGHT',
          }
        : {
            status: 'PASS',
            label: 'Equipment available',
            detail: 'Yard cranes / reach stackers ready for handover.',
          };

  const access: ValidationLayer =
    yardOccupancyPct >= 95
      ? {
          status: 'FAIL',
          label: 'Yard blocked',
          detail: `${yardZone ?? 'Yard'} is at ${Math.round(yardOccupancyPct)}% — no movement possible.`,
          reasonCode: 'YARD_BLOCKED',
        }
      : yardOccupancyPct >= 80
        ? {
            status: 'WARN',
            label: 'Yard congested',
            detail: `${yardZone ?? 'Yard'} occupancy at ${Math.round(yardOccupancyPct)}%.`,
            reasonCode: 'YARD_CONGESTED',
          }
        : {
            status: 'PASS',
            label: 'Yard accessible',
            detail: `${yardZone ?? 'Yard'} occupancy at ${Math.round(yardOccupancyPct)}%.`,
          };

  const subStatuses: ValidationStatus[] = [location.status, availabilityLayer.status, equipment.status, access.status];
  const overall: ValidationStatus = subStatuses.includes('FAIL')
    ? 'FAIL'
    : subStatuses.includes('WARN')
      ? 'WARN'
      : 'PASS';

  const reasonCode =
    [location, availabilityLayer, equipment, access].find((layer) => layer.status === 'FAIL')?.reasonCode ??
    [location, availabilityLayer, equipment, access].find((layer) => layer.status === 'WARN')?.reasonCode;

  return {
    status: overall,
    label:
      overall === 'PASS'
        ? 'Yard ready'
        : overall === 'WARN'
          ? 'Yard waiting'
          : 'Yard blocked',
    detail:
      overall === 'PASS'
        ? 'Container located, ready, equipment available, yard accessible.'
        : overall === 'WARN'
          ? 'Yard preparation is still in progress — earliest CRT will be applied.'
          : 'Yard condition currently prevents safe pickup.',
    reasonCode,
    location,
    availability: availabilityLayer,
    equipment,
    access,
  };
}

export function validateGate(params: {
  slotStart?: Date;
  slotEnd?: Date;
  usedSlots: number;
  maxSlots: number;
  isPeakHour: boolean;
  status: string;
  cargoType: CargoType;
  cargoSlotsUsed: number;
  activeIncidentForGate: boolean;
}): GateValidation {
  const {
    slotStart,
    slotEnd,
    usedSlots,
    maxSlots,
    isPeakHour,
    status,
    cargoType,
    cargoSlotsUsed,
    activeIncidentForGate,
  } = params;

  if (!slotStart || !slotEnd) {
    return {
      status: 'FAIL',
      label: 'Gate closed',
      detail: 'No gate capacity window is open in the requested horizon.',
      reasonCode: 'GATE_CLOSED',
    };
  }

  const available = Math.max(maxSlots - usedSlots, 0);
  const utilizationPct = Math.round((usedSlots / Math.max(maxSlots, 1)) * 100);
  const cargoQuotaShare = CARGO_SOFT_QUOTA[cargoType];
  const cargoQuotaCap = Math.ceil(maxSlots * cargoQuotaShare);
  const cargoQuotaExceeded = cargoSlotsUsed >= cargoQuotaCap;

  if (status === 'CLOSED' || available <= 0) {
    return {
      status: 'FAIL',
      label: 'Slot full',
      detail: `${usedSlots}/${maxSlots} slots already reserved.`,
      reasonCode: 'SLOT_FULL',
      slotStart,
      slotEnd,
      availableSlots: 0,
      utilizationPct,
    };
  }

  if (activeIncidentForGate) {
    return {
      status: 'WARN',
      label: 'Gate under incident',
      detail: 'Active disruption affects this gate window — recommendation will adjust.',
      reasonCode: 'GATE_INCIDENT',
      slotStart,
      slotEnd,
      utilizationPct,
      availableSlots: available,
    };
  }

  if (isPeakHour || utilizationPct >= 90 || cargoQuotaExceeded) {
    return {
      status: 'WARN',
      label: cargoQuotaExceeded ? `${cargoType} quota tight` : 'Peak window risk',
      detail: cargoQuotaExceeded
        ? `${cargoType} cargo has already used ${cargoSlotsUsed}/${cargoQuotaCap} of its soft quota in this window.`
        : `Peak-hour pressure: ${usedSlots}/${maxSlots} slots used.`,
      reasonCode: cargoQuotaExceeded ? 'CARGO_QUOTA_TIGHT' : 'PEAK_RISK',
      slotStart,
      slotEnd,
      utilizationPct,
      availableSlots: available,
      congestionRisk: utilizationPct,
    };
  }

  return {
    status: 'PASS',
    label: 'Gate available',
    detail: `${available} slots remaining (${utilizationPct}% utilization).`,
    slotStart,
    slotEnd,
    utilizationPct,
    availableSlots: available,
    congestionRisk: utilizationPct,
  };
}

export function computePriorityScore(params: {
  cargoType: CargoType;
  waitingMinutes: number;
  deadlineMinutes: number | null;
  resourceConstraint: number; // 0-1
  backlogPressure: number; // 0-1
  isPriorityFlag: boolean;
}): { score: number; breakdown: Record<string, number> } {
  const { cargoType, waitingMinutes, deadlineMinutes, resourceConstraint, backlogPressure, isPriorityFlag } = params;

  const cargoUrgency = CARGO_URGENCY_WEIGHT[cargoType];
  const waitPressure = Math.min(waitingMinutes / 30, 5); // every 30 min adds 1.0, cap at 5
  const deadlineRisk =
    deadlineMinutes == null
      ? cargoType === CargoType.REEFER
        ? 1.5
        : 0
      : deadlineMinutes < 120
        ? 4
        : deadlineMinutes < 360
          ? 2.5
          : 1;
  const resourceWeight =
    cargoType === CargoType.OOG ? 3.5 * resourceConstraint : cargoType === CargoType.REEFER ? 1.5 * resourceConstraint : 0.5 * resourceConstraint;
  const backlogWeight = (cargoType === CargoType.DRY ? 3 : 1) * backlogPressure;
  const priorityFlag = isPriorityFlag ? 1.5 : 0;

  const breakdown = {
    cargoUrgency,
    waitPressure,
    deadlineRisk,
    resourceWeight,
    backlogWeight,
    priorityFlag,
  };
  const score = Object.values(breakdown).reduce((acc, v) => acc + v, 0);

  return { score: Math.round(score * 100) / 100, breakdown };
}

export function deriveFinalDecision(
  commercial: CommercialValidation,
  yard: YardValidation,
  gate: GateValidation,
): { decision: 'READY' | 'WAITING' | 'BLOCKED'; blockedReason?: string } {
  if (commercial.status === 'FAIL') {
    return { decision: 'BLOCKED', blockedReason: commercial.reasonCode ?? 'COMMERCIAL_BLOCKED' };
  }
  if (yard.status === 'FAIL') {
    return { decision: 'BLOCKED', blockedReason: yard.reasonCode ?? 'YARD_BLOCKED' };
  }
  if (gate.status === 'FAIL') {
    return { decision: 'BLOCKED', blockedReason: gate.reasonCode ?? 'GATE_CLOSED' };
  }
  if (commercial.status === 'WARN' || yard.status === 'WARN' || gate.status === 'WARN') {
    return { decision: 'WAITING' };
  }
  return { decision: 'READY' };
}

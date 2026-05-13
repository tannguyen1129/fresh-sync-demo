import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, CargoType as PrismaCargoType, CustomsStatus as PrismaCustomsStatus, DOStatus as PrismaDOStatus, ContainerAvailability as PrismaContainerAvailability } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { EsgService } from '../esg/esg.service';
import {
  CreatePickupRequestDto,
  ConfirmBookingDto,
  RequestStatus,
  BookingStatus,
  AssignmentStatus,
  AssignmentType,
  EVENTS,
  BookingUpdatedPayload,
  DriverAssignmentPayload,
} from '@freshsync/shared';
import { EventsGateway } from '../gateway/events.gateway';
import {
  CARGO_SOFT_QUOTA,
  CARGO_URGENCY_WEIGHT,
  deriveFinalDecision,
  resolveCargoType,
  validateCommercial,
  validateGate,
  validateYard,
} from '../orchestration/triple-validation';

@Injectable()
export class BusinessService {
  private readonly containerInclude = {
    deliveryOrder: true,
    vessel: true,
    returnInstruction: true,
  } satisfies Prisma.ContainerInclude;

  constructor(
    private prisma: PrismaService,
    private orchestrationService: OrchestrationService,
    private events: EventsGateway,
    private esgService: EsgService,
  ) {}

  // --- 1. Create Pickup Request ---
  async createPickupRequest(companyId: string, dto: CreatePickupRequestDto) {
    const container = await this.findContainerByInput(dto.containerId);
    const requestedTime = dto.requestedTime ? new Date(dto.requestedTime) : undefined;

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    const validations = await this.validatePickupRequest(container, requestedTime, dto.cargoType);

    if (validations.finalDecision === 'BLOCKED') {
      throw new ConflictException({
        message: 'Pickup request blocked by validation rules.',
        reason: validations.blockedReason,
        containerNo: container.containerNo,
        finalDecision: validations.finalDecision,
        validations,
      });
    }

    const request = await this.prisma.pickupRequest.create({
      data: {
        companyId,
        containerId: container.id,
        requestedTime: requestedTime ?? null,
        priority: dto.priority,
        cargoType: dto.cargoType ?? null,
        truckPlate: dto.truckPlate ?? null,
        driverName: dto.driverName ?? null,
        driverPhone: dto.driverPhone ?? null,
        terminalCode: dto.terminalCode ?? null,
        status: RequestStatus.CREATED,
      },
    });

    const recommendationResult = await this.orchestrationService.generateRecommendation(request.id);

    if (!recommendationResult) {
      throw new ConflictException({
        message: 'No available gate slot in the current planning window.',
        reason: 'GATE_FULL',
        containerNo: container.containerNo,
        finalDecision: 'BLOCKED',
        validations: {
          ...validations,
          gateCapacity: {
            status: 'FAIL',
            label: 'Gate Full',
            detail: 'No available pickup slot found in the next 48 hours.',
          },
          finalDecision: 'BLOCKED',
          blockedReason: 'GATE_FULL',
        },
      });
    }

    const mergedValidations = {
      ...validations,
      yard: {
        ...validations.yard,
        availability: {
          ...validations.yard.availability,
          detail: `CRT ${new Date(recommendationResult.diagnostics.crt).toLocaleString()} and slot starts at ${new Date(recommendationResult.recommendation.slotStart).toLocaleString()}.`,
        },
      },
      gate: recommendationResult.diagnostics.gateCapacity,
      finalDecision: 'RECOMMENDED' as const,
      blockedReason: undefined,
    };

    return {
      request,
      recommendation: recommendationResult.recommendation,
      cargoType: recommendationResult.cargoType,
      priorityScore: recommendationResult.priorityScore,
      validations: mergedValidations,
      finalDecision: 'RECOMMENDED',
      containerNo: container.containerNo,
      terminalCode: dto.terminalCode ?? recommendationResult.recommendation.assignedGate ?? null,
    };
  }

  // --- 2. Get Recommendation ---
  async getRecommendation(requestId: string, companyId: string) {
    const rec = await this.prisma.recommendation.findUnique({
      where: { requestId },
      include: { request: true },
    });

    if (!rec) throw new NotFoundException('Recommendation not ready or not found');
    
    // Tenant Guard
    if (rec.request.companyId !== companyId) {
      throw new NotFoundException('Request not found'); // Obfuscate unauthorized access
    }

    return rec;
  }

  // --- 3. Confirm Booking ---
  async confirmBooking(companyId: string, dto: ConfirmBookingDto) {
    const { requestId, slotStart, slotEnd } = dto;

    // A. Fetch Request & Validate Tenant
    // FIX 1: Include container để lấy containerNo cho event
    const request = await this.prisma.pickupRequest.findUnique({
      where: { id: requestId },
      include: { container: true, recommendation: true },
    });

    if (!request || request.companyId !== companyId) {
      throw new NotFoundException('Request not found');
    }

    if (request.status === RequestStatus.CONFIRMED) {
      throw new ConflictException('Request already confirmed');
    }

    // B. Transaction
    const cargoType = resolveCargoType({
      isReefer: request.container.isReefer,
      isOog: request.container.isOog,
      cargoType: request.container.cargoType,
    });
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Find Capacity Slot
      const capacitySlot = await tx.gateCapacity.findFirst({
        where: {
          startTime: new Date(slotStart),
          endTime: new Date(slotEnd),
        },
      });

      if (!capacitySlot) {
        throw new BadRequestException('Invalid time slot selected');
      }

      // 2. Check Capacity & Increment (global + cargo-specific counter)
      const reserved = await tx.gateCapacity.updateMany({
        where: {
          id: capacitySlot.id,
          usedSlots: { lt: capacitySlot.maxSlots },
        },
        data: {
          usedSlots: { increment: 1 },
          ...(cargoType === PrismaCargoType.REEFER
            ? { reeferSlotsUsed: { increment: 1 } }
            : cargoType === PrismaCargoType.OOG
              ? { oogSlotsUsed: { increment: 1 } }
              : { drySlotsUsed: { increment: 1 } }),
        },
      });

      if (reserved.count === 0) {
        throw new ConflictException('Slot became full. Please pick another time.');
      }

      // 3. Create Booking
      const booking = await tx.booking.create({
        data: {
          requestId,
          bookingCode: this.generateBookingCode(request.container.containerNo),
          confirmedSlotStart: new Date(slotStart),
          confirmedSlotEnd: new Date(slotEnd),
          terminalCode: request.terminalCode ?? this.getTerminalCodeFromGate(String((request.recommendation?.routeJson as any)?.gate ?? 'GATE_1')),
          assignedGate: request.recommendation?.assignedGate ?? String((request.recommendation?.routeJson as any)?.gate ?? 'GATE_1'),
          qrToken: this.generateQrToken(),
          status: BookingStatus.CONFIRMED,
        },
      });

      // 4. Update Request Status
      await tx.pickupRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.CONFIRMED },
      });

      // 5. Create Assignment
      const driver = await tx.driver.findFirst({
        where: { companyId: companyId }
      });

      if (!driver) {
          throw new BadRequestException('No drivers available in your fleet to assign.');
      }

      const assignment = await tx.assignment.create({
        data: {
          bookingId: booking.id,
          driverId: driver.id,
          type: AssignmentType.PICKUP,
          status: AssignmentStatus.NEW,
          routeJson: request.recommendation?.routeJson ?? { steps: ['Gate 1', request.container.yardZone ?? 'ZONE_A', 'Gate Out'] },
        },
      });

      // Trả về dữ liệu cần thiết ra ngoài transaction scope
      return { booking, assignment, driver };
    });

    // C. Emit Event (Sau khi transaction commit thành công)
    const payload: BookingUpdatedPayload = {
      bookingId: result.booking.id,
      requestId: requestId,
      newStatus: BookingStatus.CONFIRMED,
      status: BookingStatus.CONFIRMED,
      slotStart: result.booking.confirmedSlotStart.toISOString(),
      slotEnd: result.booking.confirmedSlotEnd.toISOString(),
      // FIX 3: Dùng containerNo thật
      containerNo: request.container.containerNo 
    };
    
    this.events.emit(EVENTS.BOOKING_UPDATED, payload);

    const assignmentPayload: DriverAssignmentPayload = {
      assignmentId: result.assignment.id,
      bookingId: result.booking.id,
      type: result.assignment.type as unknown as AssignmentType,
      status: result.assignment.status as unknown as AssignmentStatus,
      containerNo: request.container.containerNo,
      driverName: result.driver.name,
      licensePlate: result.driver.licensePlate,
      location: {
        name: String((result.assignment.routeJson as any)?.gate ?? (result.assignment.routeJson as any)?.destination ?? 'PORT'),
        lat: Number((result.assignment.routeJson as any)?.lat ?? 10.77),
        lng: Number((result.assignment.routeJson as any)?.lng ?? 106.78),
      },
      timeWindow: {
        start: result.booking.confirmedSlotStart.toISOString(),
        end: result.booking.confirmedSlotEnd.toISOString(),
      },
      updatedAt: result.assignment.updatedAt.toISOString(),
    };

    this.events.emit(EVENTS.DRIVER_ASSIGNMENT_CREATED, assignmentPayload);
    
    return result;
  }

  // --- 4. Get Bookings ---
  async getMyBookings(companyId: string) {
    return this.prisma.booking.findMany({
      where: {
        request: { companyId },
      },
      include: {
        request: {
          include: { container: true },
        },
        assignments: {
          include: { driver: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMyRequests(companyId: string) {
    return this.prisma.pickupRequest.findMany({
      where: { companyId },
      include: {
        container: true,
        recommendation: true,
        booking: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getRoiReport(companyId: string, from?: string, to?: string) {
    return this.esgService.getBusinessRoiReport(companyId, from, to);
  }

  private async validatePickupRequest(container: any, requestedTime?: Date, cargoHint?: string | null) {
    const now = new Date();
    const referenceTime = requestedTime ?? container.crt ?? now;
    const deliveryOrder = container.deliveryOrder;
    const doValidUntil = deliveryOrder?.validUntil ? new Date(deliveryOrder.validUntil) : null;
    const cargoType = resolveCargoType({
      isReefer: container.isReefer,
      isOog: container.isOog,
      cargoType: container.cargoType,
      hintFromRequest: cargoHint,
    });

    const commercial = validateCommercial({
      doStatus: deliveryOrder?.status as PrismaDOStatus | null,
      doValidUntil,
      customsStatus: deliveryOrder?.customsStatus as PrismaCustomsStatus | null,
      cargoType,
      now,
    });

    const yardZone = container.yardZone as string | null;
    const yardStatus = yardZone
      ? await this.prisma.yardStatus.findUnique({ where: { zoneId: yardZone } })
      : null;

    const equipmentNeeded =
      cargoType === PrismaCargoType.OOG
        ? 'OOG_HANDLER'
        : cargoType === PrismaCargoType.REEFER
          ? 'REEFER_POWER'
          : 'REACH_STACKER';
    const equipmentItems = await this.prisma.yardEquipment.findMany({
      where: { type: equipmentNeeded },
    });
    const equipmentAvailableCount = equipmentItems.filter((item) => item.status === 'AVAILABLE').length;
    const equipmentBusyCount = equipmentItems.filter((item) => item.status === 'BUSY').length;

    const containerAvailability = (container.availability ?? PrismaContainerAvailability.READY) as PrismaContainerAvailability;

    const yard = validateYard({
      containerStatus: container.status,
      availability: containerAvailability,
      yardZone,
      yardBlock: container.yardBlock,
      yardOccupancyPct: yardStatus?.occupancyPct ?? 50,
      equipmentAvailable: equipmentAvailableCount > 0 || equipmentItems.length === 0,
      equipmentBusyCount,
      cargoType,
      specialEquipmentReady: cargoType === PrismaCargoType.DRY || equipmentAvailableCount > 0,
      crt: container.crt ? new Date(container.crt) : null,
      now,
    });

    const gateCap = await this.prisma.gateCapacity.findFirst({
      where: { startTime: { gte: referenceTime }, status: { in: ['OPEN', 'RESTRICTED'] } },
      orderBy: { startTime: 'asc' },
    });
    const activeIncidentForGate = gateCap
      ? (await this.prisma.disruption.count({
          where: {
            isActive: true,
            affectedZones: { hasSome: yardZone ? [yardZone] : [] },
          },
        })) > 0
      : false;
    const cargoSlotsUsed = gateCap
      ? cargoType === PrismaCargoType.REEFER
        ? gateCap.reeferSlotsUsed
        : cargoType === PrismaCargoType.OOG
          ? gateCap.oogSlotsUsed
          : gateCap.drySlotsUsed
      : 0;

    const gate = validateGate({
      slotStart: gateCap?.startTime,
      slotEnd: gateCap?.endTime,
      usedSlots: gateCap?.usedSlots ?? 0,
      maxSlots: gateCap?.maxSlots ?? 0,
      isPeakHour: gateCap?.isPeakHour ?? false,
      status: gateCap?.status ?? 'CLOSED',
      cargoType,
      cargoSlotsUsed,
      activeIncidentForGate,
    });

    const decision = deriveFinalDecision(commercial, yard, gate);

    return {
      commercial,
      yard,
      gate,
      cargoType,
      softQuota: CARGO_SOFT_QUOTA[cargoType],
      urgencyWeight: CARGO_URGENCY_WEIGHT[cargoType],
      finalDecision: decision.decision,
      blockedReason: decision.blockedReason ?? null,
    };
  }

  private async findContainerByInput(input: string) {
    const normalized = input.trim().toUpperCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);

    return this.prisma.container.findFirst({
      where: isUuid
        ? {
            OR: [
              { id: normalized },
              { containerNo: normalized },
            ],
          }
        : { containerNo: normalized },
      include: this.containerInclude,
    });
  }

  private generateBookingCode(containerNo: string) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = containerNo.replace(/[^0-9]/g, '').slice(-3) || '000';
    return `FS-${stamp}-${suffix}-${randomBytes(2).toString('hex').toUpperCase()}`;
  }

  private generateQrToken() {
    return `FSQR-${randomBytes(6).toString('hex').toUpperCase()}`;
  }

  private getTerminalCodeFromGate(gate: string) {
    if (gate === 'GATE_2') return 'TML-B';
    if (gate === 'GATE_COLD') return 'TML-R';
    return 'TML-A';
  }
}

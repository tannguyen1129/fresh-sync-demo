import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { EventsGateway } from '../gateway/events.gateway';
import {
  CreateGateCapacityDto,
  UpdatePriorityRulesDto,
  BlockResourceDto,
  BlockTargetType,
} from './dto/operator.dto';
import {
  BookingStatus,
  CreateDisruptionDto,
  DisruptionType,
  DOStatus,
  EVENTS,
  NotificationPayload,
  Severity,
  BookingUpdatedPayload,
  DisruptionCreatedPayload,
} from '@freshsync/shared';

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    private prisma: PrismaService,
    private orchestration: OrchestrationService,
    private events: EventsGateway,
  ) {}

  // --- 1. Gate Capacity Management ---

  async createGateCapacity(dto: CreateGateCapacityDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const usedSlots = dto.usedSlots ?? 0;
    const status = dto.status ?? this.deriveCapacityStatus(usedSlots, dto.maxSlots);

    return this.prisma.gateCapacity.upsert({
      where: {
        startTime_endTime: {
          startTime,
          endTime,
        },
      },
      update: {
        maxSlots: dto.maxSlots,
        usedSlots,
        status,
        isPeakHour: dto.isPeakHour ?? undefined,
      },
      create: {
        startTime,
        endTime,
        maxSlots: dto.maxSlots,
        usedSlots,
        status,
        isPeakHour: dto.isPeakHour ?? false,
      },
    });
  }

  async getGateCapacities(from: Date, to: Date) {
    return this.prisma.gateCapacity.findMany({
      where: {
        startTime: { gte: from },
        endTime: { lte: to },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  // --- 2. Priority Rules (JSON Store) ---

  async updatePriorityRules(dto: UpdatePriorityRulesDto, userId: string) {
    return this.prisma.systemSetting.upsert({
      where: { key: 'PRIORITY_RULES' },
      update: {
        value: dto.rules,
        updatedBy: userId,
      },
      create: {
        key: 'PRIORITY_RULES',
        value: dto.rules,
        updatedBy: userId,
      },
    });
  }

  async getPriorityRules() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'PRIORITY_RULES' },
    });
    return setting?.value || { default: true };
  }

  // --- 3. Disruptions & Manual Override ---

  async createDisruption(dto: CreateDisruptionDto, userId: string) {
    const disruption = await this.prisma.disruption.create({
      data: {
        type: dto.type as DisruptionType,
        severity: dto.severity as Severity,
        startTime: new Date(dto.startTime),
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        affectedZones: dto.affectedZones,
        description: dto.description,
        isActive: true,
      },
    });

    await this.logAudit(userId, 'CREATE_DISRUPTION', 'Disruption', disruption.id, dto);
    await this.orchestration.triggerDisruptionReoptimization(disruption.id);
    this.emitDisruptionCreated(disruption);

    return disruption;
  }

  async getDisruptions() {
    return this.prisma.disruption.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async blockResource(dto: BlockResourceDto, userId: string) {
    if (dto.targetType === BlockTargetType.CONTAINER) {
      const container = await this.prisma.container.findUnique({
        where: { containerNo: dto.targetId },
      });
      if (!container) throw new NotFoundException('Container not found');

      await this.prisma.deliveryOrder.upsert({
        where: { containerId: container.id },
        update: { status: DOStatus.HOLD },
        create: {
          containerId: container.id,
          status: DOStatus.HOLD,
        },
      });

      const impactedBookings = await this.prisma.booking.findMany({
        where: {
          request: { containerId: container.id },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED] },
        },
        include: {
          request: {
            include: { container: true },
          },
        },
      });

      for (const booking of impactedBookings) {
        const updated = await this.prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.BLOCKED,
            blockedReason: `Manual Block: ${dto.reason}`,
          },
        });

        await this.notifyCompany(
          booking.request.companyId,
          'Booking Blocked',
          `Container ${booking.request.container.containerNo} was blocked by Control Tower: ${dto.reason}.`,
          'ERROR',
        );

        this.emitBookingUpdated({
          bookingId: updated.id,
          requestId: updated.requestId,
          newStatus: BookingStatus.BLOCKED,
          status: BookingStatus.BLOCKED,
          reason: updated.blockedReason ?? undefined,
          slotStart: updated.confirmedSlotStart.toISOString(),
          slotEnd: updated.confirmedSlotEnd.toISOString(),
          containerNo: booking.request.container.containerNo,
        });
      }

      await this.logAudit(userId, 'MANUAL_BLOCK_CONTAINER', 'Container', container.id, dto);

      return {
        message: `Container ${dto.targetId} blocked and DO set to HOLD`,
        impactedBookings: impactedBookings.length,
      };
    }

    let type = DisruptionType.SYSTEM_MAINTENANCE;
    if (dto.targetType === BlockTargetType.GATE) type = DisruptionType.GATE_CONGESTION;
    if (dto.targetType === BlockTargetType.ZONE) type = DisruptionType.CRANE_BREAKDOWN;

    const disruption = await this.createDisruption(
      {
        type,
        severity: Severity.HIGH,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        affectedZones: [dto.targetId],
        description: `Manual Override: ${dto.reason}`,
      },
      userId,
    );

    return {
      message: `${dto.targetType} ${dto.targetId} blocked. Re-optimization triggered.`,
      disruption,
    };
  }

  async resetDemoScenario() {
    const released = await this.prisma.disruption.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    await this.prisma.deliveryOrder.updateMany({
      where: {
        container: {
          containerNo: { not: 'CONT-013' },
        },
        status: DOStatus.HOLD,
      },
      data: {
        status: DOStatus.RELEASED,
      },
    });

    const restoredBookings = await this.prisma.booking.updateMany({
      where: {
        status: { in: [BookingStatus.BLOCKED, BookingStatus.RESCHEDULED] },
        OR: [
          { blockedReason: { startsWith: 'Manual Block:' } },
          { blockedReason: { contains: 'Commercial Hold applied by Shipping Line' } },
          { blockedReason: { contains: 'Rescheduled due to' } },
        ],
      },
      data: {
        status: BookingStatus.CONFIRMED,
        blockedReason: null,
      },
    });

    await this.prisma.yardStatus.updateMany({
      where: { zoneId: 'ZONE_A' },
      data: { occupancyPct: 45.5 },
    });
    await this.prisma.yardStatus.updateMany({
      where: { zoneId: 'ZONE_B' },
      data: { occupancyPct: 88.0 },
    });
    await this.prisma.yardStatus.updateMany({
      where: { zoneId: 'ZONE_C' },
      data: { occupancyPct: 12.0 },
    });
    await this.prisma.yardStatus.updateMany({
      where: { zoneId: 'ZONE_REEFER' },
      data: { occupancyPct: 60.0 },
    });

    const capacities = await this.prisma.gateCapacity.findMany({
      where: {
        startTime: { gte: new Date() },
      },
      take: 12,
      orderBy: { startTime: 'asc' },
    });

    await Promise.all(
      capacities.map((capacity) =>
        this.prisma.gateCapacity.update({
          where: { id: capacity.id },
          data: {
            usedSlots: this.getBaselineGateUtilization(capacity.startTime.getHours()),
            status: this.deriveCapacityStatus(this.getBaselineGateUtilization(capacity.startTime.getHours()), capacity.maxSlots),
          },
        }),
      ),
    );

    return {
      message: 'Sprint 4 demo scenario reset.',
      deactivatedDisruptions: released.count,
      restoredBookings: restoredBookings.count,
    };
  }

  async getMapSnapshot() {
    const [yardStatuses, capacities, disruptions, assignments] = await Promise.all([
      this.prisma.yardStatus.findMany({ orderBy: { zoneId: 'asc' } }),
      this.prisma.gateCapacity.findMany({
        where: {
          startTime: { gte: new Date() },
        },
        take: 4,
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.disruption.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.assignment.findMany({
        where: {
          status: {
            in: ['NEW', 'ENROUTE', 'ARRIVED_GATE', 'PICKED_UP', 'DEPARTED', 'RETURN_EMPTY_STARTED'],
          },
        },
        include: {
          driver: true,
          booking: {
            include: {
              request: {
                include: { container: true },
              },
            },
          },
        },
        take: 20,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const terminals = [
      { code: 'TML-A', name: 'Terminal A', gate: 'GATE_1', zone: 'ZONE_A', x: 26, y: 30, lat: 10.7761, lng: 106.7909 },
      { code: 'TML-B', name: 'Terminal B', gate: 'GATE_2', zone: 'ZONE_B', x: 58, y: 34, lat: 10.7792, lng: 106.7992 },
      { code: 'TML-R', name: 'Reefer Yard', gate: 'GATE_COLD', zone: 'ZONE_REEFER', x: 78, y: 62, lat: 10.7715, lng: 106.8052 },
    ];

    const gates = capacities.map((capacity, index) => ({
      id: index === 1 ? 'GATE_2' : index === 2 ? 'GATE_COLD' : 'GATE_1',
      label: index === 1 ? 'Gate 2' : index === 2 ? 'Cold Gate' : 'Gate 1',
      usedSlots: capacity.usedSlots,
      maxSlots: capacity.maxSlots,
      status: capacity.status,
      isPeakHour: capacity.isPeakHour,
      utilizationPct: Math.round((capacity.usedSlots / Math.max(capacity.maxSlots, 1)) * 100),
      timeWindow: {
        start: capacity.startTime,
        end: capacity.endTime,
      },
      lat: index === 1 ? 10.7778 : index === 2 ? 10.7703 : 10.7749,
      lng: index === 1 ? 106.7974 : index === 2 ? 106.8043 : 106.7894,
    }));

    const trucks = assignments.map((assignment, index) => ({
      assignmentId: assignment.id,
      driverName: assignment.driver.name,
      containerNo: assignment.booking.request.container.containerNo,
      type: assignment.type,
      status: assignment.status,
      gate: assignment.booking.assignedGate ?? (assignment.routeJson as any)?.gate ?? 'GATE_1',
      terminalCode: assignment.booking.terminalCode ?? 'TML-A',
      lat: assignment.driver.currentLat ?? (assignment.routeJson as any)?.lat ?? 10.77,
      lng: assignment.driver.currentLng ?? (assignment.routeJson as any)?.lng ?? 106.78,
      mapX: 14 + ((index * 11) % 70),
      mapY: 20 + ((index * 9) % 55),
    }));

    return {
      updatedAt: new Date().toISOString(),
      center: {
        lat: 10.7756,
        lng: 106.7961,
      },
      terminals,
      gates,
      yardStatuses: yardStatuses.map((yard) => ({
        zoneId: yard.zoneId,
        occupancyPct: Math.round(yard.occupancyPct),
      })),
      disruptions: disruptions.map((disruption) => ({
        id: disruption.id,
        type: disruption.type,
        severity: disruption.severity,
        description: disruption.description,
        affectedZones: disruption.affectedZones,
      })),
      trucks,
    };
  }

  async startScenario(type: string, userId: string) {
    const normalized = type.trim().toUpperCase();

    if (normalized === 'PEAK_HOUR') {
      const capacities = await this.prisma.gateCapacity.findMany({
        where: {
          startTime: { gte: new Date() },
        },
        take: 4,
        orderBy: { startTime: 'asc' },
      });

      await Promise.all(
        capacities.map((capacity) =>
          this.prisma.gateCapacity.update({
            where: { id: capacity.id },
            data: {
              usedSlots: Math.min(capacity.maxSlots, Math.max(capacity.usedSlots, Math.round(capacity.maxSlots * 0.95))),
              status: 'RESTRICTED',
              isPeakHour: true,
            },
          }),
        ),
      );

      return {
        scenario: 'PEAK_HOUR',
        message: 'Peak-hour pressure applied to gate windows.',
      };
    }

    if (normalized === 'TERMINAL_OVERLOAD') {
      await this.prisma.yardStatus.update({
        where: { zoneId: 'ZONE_B' },
        data: { occupancyPct: 97 },
      });

      const disruption = await this.createDisruption(
        {
          type: DisruptionType.CRANE_BREAKDOWN,
          severity: Severity.HIGH,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
          affectedZones: ['ZONE_B', 'GATE_2'],
          description: 'Terminal B overload triggered from simulation panel',
        },
        userId,
      );

      return {
        scenario: 'TERMINAL_OVERLOAD',
        message: 'Terminal B overload injected.',
        disruption,
      };
    }

    if (normalized === 'ACCIDENT_NEAR_PORT') {
      const disruption = await this.createDisruption(
        {
          type: DisruptionType.GATE_CONGESTION,
          severity: Severity.CRITICAL,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          affectedZones: ['GATE_1', 'GATE_2'],
          description: 'Road accident near port access road. Delay inbound trucks by 20 minutes.',
        },
        userId,
      );

      return {
        scenario: 'ACCIDENT_NEAR_PORT',
        message: 'Accident delay scenario started.',
        disruption,
      };
    }

    throw new NotFoundException(`Unknown scenario ${type}`);
  }

  // --- 4. Monitor Congestion ---

  async getCongestionMetrics() {
    const now = new Date();
    const gateCap = await this.prisma.gateCapacity.findFirst({
      where: {
        startTime: { lte: now },
        endTime: { gte: now },
      },
    });
    const gateUtilization = gateCap ? (gateCap.usedSlots / Math.max(gateCap.maxSlots, 1)) * 100 : 0;

    const yardStatuses = await this.prisma.yardStatus.findMany();
    const avgYardOccupancy = yardStatuses.length > 0
      ? yardStatuses.reduce((acc, curr) => acc + curr.occupancyPct, 0) / yardStatuses.length
      : 0;

    const activeDisruptions = await this.prisma.disruption.count({
      where: { isActive: true },
    });

    let riskLevel = 'LOW';
    const riskScore = (gateUtilization * 0.4) + (avgYardOccupancy * 0.4) + (activeDisruptions * 10);

    if (riskScore > 80) riskLevel = 'CRITICAL';
    else if (riskScore > 50) riskLevel = 'HIGH';
    else if (riskScore > 30) riskLevel = 'MEDIUM';

    return {
      timestamp: now,
      riskLevel,
      metrics: {
        gateUtilization: Math.round(gateUtilization),
        avgYardOccupancy: Math.round(avgYardOccupancy),
        activeDisruptions,
        currentWindow: gateCap ? {
          startTime: gateCap.startTime,
          endTime: gateCap.endTime,
          usedSlots: gateCap.usedSlots,
          maxSlots: gateCap.maxSlots,
          status: gateCap.status,
        } : null,
      },
    };
  }

  // --- 5. Monitor Impacted Bookings ---

  async getImpactedBookings() {
    return this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.RESCHEDULED, BookingStatus.BLOCKED, BookingStatus.CANCELLED] },
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: {
        request: {
          include: { container: true, company: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  private deriveCapacityStatus(usedSlots: number, maxSlots: number) {
    if (maxSlots === 0) return 'CLOSED';
    const utilization = usedSlots / Math.max(maxSlots, 1);
    if (utilization >= 1) return 'CLOSED';
    if (utilization >= 0.85) return 'RESTRICTED';
    return 'OPEN';
  }

  private getBaselineGateUtilization(hour: number) {
    if (hour >= 14 && hour <= 17) return hour === 16 ? 100 : 95;
    if (hour >= 12 && hour <= 13) return 68;
    if (hour >= 9 && hour <= 11) return 54;
    if (hour >= 18 && hour <= 20) return 46;
    if (hour >= 6 && hour <= 8) return 32;
    return 18;
  }

  private emitDisruptionCreated(disruption: { id: string; type: string; severity: string; description: string; affectedZones: string[] }) {
    const payload: DisruptionCreatedPayload = {
      id: disruption.id,
      type: disruption.type,
      severity: disruption.severity,
      description: disruption.description,
      affectedZones: disruption.affectedZones,
    };
    this.events.emit(EVENTS.DISRUPTION_CREATED, payload);
  }

  private emitBookingUpdated(payload: BookingUpdatedPayload) {
    this.events.emit(EVENTS.BOOKING_UPDATED, payload);
  }

  private async notifyCompany(companyId: string, title: string, message: string, type: NotificationPayload['type']) {
    const user = await this.prisma.user.findFirst({ where: { companyId } });
    if (!user) return;

    const notification = await this.prisma.notification.create({
      data: {
        userId: user.id,
        title,
        message,
        type,
      },
    });

    const payload: NotificationPayload = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type,
      createdAt: notification.createdAt.toISOString(),
    };
    this.events.emit(EVENTS.NOTIFICATION_CREATED, payload);
  }

  private async logAudit(actorId: string, action: string, entityType: string, entityId: string, details: unknown) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    });
  }
}

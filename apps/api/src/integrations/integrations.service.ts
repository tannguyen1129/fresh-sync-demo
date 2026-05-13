import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IngestDOUpdateDto,
  IngestVesselDelayDto,
  BookingStatus,
  DOStatus,
  DisruptionType,
  Severity,
  CreateDisruptionDto,
  EVENTS,
  BookingUpdatedPayload,
  DisruptionCreatedPayload,
  NotificationPayload,
} from '@freshsync/shared';
import { OrchestrationService } from 'src/orchestration/orchestration.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private prisma: PrismaService,
    private orchestrationService: OrchestrationService,
    private events: EventsGateway,
  ) {}

  // --- Shipping Line Integrations ---

  async updateDOStatus(dto: IngestDOUpdateDto, actorId: string) {
    const container = await this.prisma.container.findUnique({
      where: { containerNo: dto.containerNo },
      include: { deliveryOrder: true },
    });

    if (!container) {
      throw new NotFoundException(`Container ${dto.containerNo} not found`);
    }

    const oldStatus = container.deliveryOrder?.status;

    const updatedDO = await this.prisma.deliveryOrder.upsert({
      where: { containerId: container.id },
      update: {
        status: dto.status,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
      create: {
        containerId: container.id,
        status: dto.status,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });

    await this.logAudit(actorId, 'UPDATE_DO', 'DeliveryOrder', updatedDO.id, { old: oldStatus, new: dto.status });

    if (dto.status === DOStatus.HOLD) {
      await this.enforceDOHold(container.id, dto.containerNo);
    }

    return updatedDO;
  }

  private async enforceDOHold(containerId: string, containerNo: string) {
    const activeBookings = await this.prisma.booking.findMany({
      where: {
        request: { containerId },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED] },
      },
      include: {
        request: {
          include: { container: true },
        },
      },
    });

    for (const activeBooking of activeBookings) {
      const updated = await this.prisma.booking.update({
        where: { id: activeBooking.id },
        data: {
          status: BookingStatus.BLOCKED,
          blockedReason: 'Commercial Hold applied by Shipping Line',
        },
      });

      await this.notifyCompany(
        activeBooking.request.companyId,
        'Booking Blocked',
        `Booking for container ${containerNo} has been blocked due to D/O HOLD status.`,
        'ERROR',
      );

      const payload: BookingUpdatedPayload = {
        bookingId: updated.id,
        requestId: updated.requestId,
        newStatus: BookingStatus.BLOCKED,
        status: BookingStatus.BLOCKED,
        reason: updated.blockedReason ?? undefined,
        slotStart: updated.confirmedSlotStart.toISOString(),
        slotEnd: updated.confirmedSlotEnd.toISOString(),
        containerNo,
      };
      this.events.emit(EVENTS.BOOKING_UPDATED, payload);

      this.logger.warn(`Booking ${activeBooking.id} BLOCKED due to DO HOLD on Container ${containerNo}`);
    }
  }

  async updateVessel(dto: IngestVesselDelayDto, actorId: string) {
    const vessel = await this.prisma.vessel.findUnique({ where: { vesselCode: dto.vesselCode } });
    if (!vessel) throw new NotFoundException('Vessel not found');

    const updated = await this.prisma.vessel.update({
      where: { id: vessel.id },
      data: { eta: new Date(dto.newEta) },
    });

    await this.logAudit(actorId, 'UPDATE_VESSEL_ETA', 'Vessel', vessel.id, { oldEta: vessel.eta, newEta: dto.newEta });
    return updated;
  }

  // --- TOS Integrations ---

  async reportDisruption(dto: CreateDisruptionDto, actorId: string) {
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

    await this.logAudit(actorId, 'REPORT_DISRUPTION', 'Disruption', disruption.id, dto);
    await this.orchestrationService.triggerDisruptionReoptimization(disruption.id);

    const payload: DisruptionCreatedPayload = {
      id: disruption.id,
      type: disruption.type,
      severity: disruption.severity,
      description: disruption.description,
      affectedZones: disruption.affectedZones,
    };
    this.events.emit(EVENTS.DISRUPTION_CREATED, payload);

    return disruption;
  }

  async updateYardSnapshot(snapshotData: any, actorId: string) {
    const yardEntries = Object.entries((snapshotData?.yardOccupancy ?? {}) as Record<string, number>);

    for (const [zoneId, occupancyPct] of yardEntries) {
      await this.prisma.yardStatus.upsert({
        where: { zoneId },
        update: { occupancyPct: Number(occupancyPct) },
        create: {
          zoneId,
          occupancyPct: Number(occupancyPct),
        },
      });
    }

    if (snapshotData?.gateLoad !== undefined) {
      const now = new Date();
      const gateSlot = await this.prisma.gateCapacity.findFirst({
        where: {
          startTime: { lte: now },
          endTime: { gte: now },
        },
      });

      if (gateSlot) {
        const nextUsedSlots = Math.min(
          gateSlot.maxSlots,
          Math.max(0, Math.round((Number(snapshotData.gateLoad) / 100) * gateSlot.maxSlots)),
        );
        await this.prisma.gateCapacity.update({
          where: { id: gateSlot.id },
          data: {
            usedSlots: nextUsedSlots,
          },
        });
      }
    }

    this.logger.log(`Received TOS Snapshot: ${JSON.stringify(snapshotData)}`);
    await this.logAudit(actorId, 'INGEST_TOS_SNAPSHOT', 'System', 'N/A', { size: JSON.stringify(snapshotData).length });
    return { received: true };
  }

  private async notifyCompany(companyId: string, title: string, message: string, type: NotificationPayload['type']) {
    const user = await this.prisma.user.findFirst({
      where: { companyId },
    });

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

  // --- Helper ---
  private async logAudit(actorId: string, action: string, entity: string, entityId: string, details: any) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType: entity,
        entityId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    });
  }
}

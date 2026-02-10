import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  IngestDOUpdateDto, 
  IngestVesselDelayDto, 
  BookingStatus, 
  DOStatus, 
  DisruptionType,
  Severity
} from '@freshsync/shared';
import { CreateDisruptionDto } from '@freshsync/shared'; // Reuse schema type
import { OrchestrationService } from 'src/orchestration/orchestration.service';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private prisma: PrismaService,
    private orchestrationService: OrchestrationService
  ) {}

  // --- Shipping Line Integrations ---

  async updateDOStatus(dto: IngestDOUpdateDto, actorId: string) {
    // 1. Find Container
    const container = await this.prisma.container.findUnique({
      where: { containerNo: dto.containerNo },
      include: { deliveryOrder: true }
    });

    if (!container) {
      throw new NotFoundException(`Container ${dto.containerNo} not found`);
    }

    const oldStatus = container.deliveryOrder?.status;

    // 2. Upsert DO
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

    // 3. Audit Log
    await this.logAudit(actorId, 'UPDATE_DO', 'DeliveryOrder', updatedDO.id, { old: oldStatus, new: dto.status });

    // 4. Business Rule: Enforce HOLD
    if (dto.status === DOStatus.HOLD) {
      await this.enforceDOHold(container.id, dto.containerNo);
    }

    return updatedDO;
  }

  private async enforceDOHold(containerId: string, containerNo: string) {
    // Find active bookings for this container
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        request: { containerId: containerId },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED] }
      },
      include: { request: true } // to get userId/companyId for notification
    });

    if (activeBooking) {
      // Block Booking
      await this.prisma.booking.update({
        where: { id: activeBooking.id },
        data: {
          status: BookingStatus.BLOCKED,
          blockedReason: 'Commercial Hold applied by Shipping Line',
        }
      });

      // Find user to notify (Logistics Coordinator of that company)
      // Demo simplification: Notify the first user of that company
      const userToNotify = await this.prisma.user.findFirst({
        where: { companyId: activeBooking.request.companyId }
      });

      if (userToNotify) {
        await this.prisma.notification.create({
          data: {
            userId: userToNotify.id,
            title: 'Booking Blocked 🛑',
            message: `Booking for container ${containerNo} has been BLOCKED due to D/O HOLD status.`,
            type: 'ERROR'
          }
        });
      }
      
      this.logger.warn(`Booking ${activeBooking.id} BLOCKED due to DO HOLD on Container ${containerNo}`);
    }
  }

  async updateVessel(dto: IngestVesselDelayDto, actorId: string) {
     // Demo simple update
     const vessel = await this.prisma.vessel.findUnique({ where: { vesselCode: dto.vesselCode }});
     if(!vessel) throw new NotFoundException('Vessel not found');

     const updated = await this.prisma.vessel.update({
         where: { id: vessel.id },
         data: { eta: new Date(dto.newEta) }
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
        isActive: true
      }
    });

    await this.orchestrationService.triggerDisruptionReoptimization(disruption.id);
    
    // Note: Re-optimization trigger would go here (BullMQ job)
    return disruption;
  }

  async updateYardSnapshot(snapshotData: any, actorId: string) {
      // Demo: Log that we received snapshot
      this.logger.log(`Received TOS Snapshot: ${JSON.stringify(snapshotData)}`);
      await this.logAudit(actorId, 'INGEST_TOS_SNAPSHOT', 'System', 'N/A', { size: JSON.stringify(snapshotData).length });
      return { received: true };
  }

  // --- Helper ---
  private async logAudit(actorId: string, action: string, entity: string, entityId: string, details: any) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType: entity,
        entityId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined
      }
    });
  }
}
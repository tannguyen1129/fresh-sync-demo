import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { 
  CreateGateCapacityDto, 
  UpdatePriorityRulesDto, 
  BlockResourceDto, 
  BlockTargetType 
} from './dto/operator.dto';
import { DisruptionType, Severity, DOStatus, BookingStatus } from '@freshsync/shared';

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    private prisma: PrismaService,
    private orchestration: OrchestrationService
  ) {}

  // --- 1. Gate Capacity Management ---

  async createGateCapacity(dto: CreateGateCapacityDto) {
    // Check overlap simple logic (Demo)
    // Production would require checking range overlap
    return this.prisma.gateCapacity.create({
      data: {
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        maxSlots: dto.maxSlots,
        status: 'OPEN',
      }
    });
  }

  async getGateCapacities(from: Date, to: Date) {
    return this.prisma.gateCapacity.findMany({
      where: {
        startTime: { gte: from },
        endTime: { lte: to }
      },
      orderBy: { startTime: 'asc' }
    });
  }

  // --- 2. Priority Rules (JSON Store) ---

  async updatePriorityRules(dto: UpdatePriorityRulesDto, userId: string) {
    return this.prisma.systemSetting.upsert({
      where: { key: 'PRIORITY_RULES' },
      update: {
        value: dto.rules,
        updatedBy: userId
      },
      create: {
        key: 'PRIORITY_RULES',
        value: dto.rules,
        updatedBy: userId
      }
    });
  }

  async getPriorityRules() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'PRIORITY_RULES' }
    });
    return setting?.value || { default: true };
  }

  // --- 3. Manual Override / Block ---

  async blockResource(dto: BlockResourceDto, userId: string) {
    let disruptionId = '';

    // Case A: Block Container -> Set DO to HOLD (Soft Block) or Cancel Booking
    if (dto.targetType === BlockTargetType.CONTAINER) {
      const container = await this.prisma.container.findUnique({
        where: { containerNo: dto.targetId }
      });
      if (!container) throw new NotFoundException('Container not found');

      // Update DO to HOLD
      await this.prisma.deliveryOrder.update({
        where: { containerId: container.id },
        data: { status: DOStatus.HOLD }
      });
      
      // Cancel active bookings
      await this.prisma.booking.updateMany({
        where: { 
            request: { containerId: container.id },
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED] }
        },
        data: {
            status: BookingStatus.BLOCKED,
            blockedReason: `Manual Block: ${dto.reason}`
        }
      });

      return { message: `Container ${dto.targetId} blocked and DO set to HOLD` };
    }

    // Case B: Block Zone or Gate -> Create Disruption -> Re-optimize
    let type = DisruptionType.SYSTEM_MAINTENANCE;
    if (dto.targetType === BlockTargetType.GATE) type = DisruptionType.GATE_CONGESTION;
    if (dto.targetType === BlockTargetType.ZONE) type = DisruptionType.CRANE_BREAKDOWN; // Demo mapping

    const disruption = await this.prisma.disruption.create({
      data: {
        type: type,
        severity: Severity.HIGH,
        startTime: new Date(),
        // Default block for 2 hours if manual
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), 
        affectedZones: [dto.targetId], // "GATE_1" or "ZONE_A"
        description: `Manual Override: ${dto.reason}`,
        isActive: true
      }
    });

    // Trigger Engine
    await this.orchestration.triggerDisruptionReoptimization(disruption.id);

    return { 
        message: `${dto.targetType} ${dto.targetId} blocked. Re-optimization triggered.`,
        disruption 
    };
  }

  // --- 4. Monitor Congestion ---

  async getCongestionMetrics() {
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

    // 1. Gate Utilization (Next 1 hour)
    const gateCap = await this.prisma.gateCapacity.findFirst({
        where: {
            startTime: { lte: now },
            endTime: { gte: now }
        }
    });
    const gateUtilization = gateCap ? (gateCap.usedSlots / gateCap.maxSlots) * 100 : 0;

    // 2. Yard Occupancy (Average)
    const yardStatuses = await this.prisma.yardStatus.findMany();
    const avgYardOccupancy = yardStatuses.length > 0 
        ? yardStatuses.reduce((acc, curr) => acc + curr.occupancyPct, 0) / yardStatuses.length 
        : 0;

    // 3. Active Disruptions
    const activeDisruptions = await this.prisma.disruption.count({
        where: { isActive: true }
    });

    // 4. Compute Risk Level (Simple Formula)
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
            activeDisruptions
        }
    };
  }

  // --- 5. Monitor Impacted Bookings ---

  async getImpactedBookings() {
    return this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.RESCHEDULED, BookingStatus.BLOCKED, BookingStatus.CANCELLED] },
        // Chỉ lấy trong 24h qua
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      include: {
        request: {
            include: { container: true, company: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });
  }
}
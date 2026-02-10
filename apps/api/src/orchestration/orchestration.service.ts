import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestStatus, BookingStatus } from '@freshsync/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('orchestration') private orchestrationQueue: Queue,
  ) {}

  // --- 1. Core Logic: Generate Recommendation ---

  async generateRecommendation(requestId: string) {
    const request = await this.prisma.pickupRequest.findUnique({
      where: { id: requestId },
      include: { container: { include: { vessel: true } } },
    });

    if (!request) throw new NotFoundException('Request not found');

    // Step A: Predict CRT (Container Readiness Time)
    const crt = await this.predictCRT(request.container);
    
    // Update CRT in DB if changed
    await this.prisma.container.update({
      where: { id: request.containerId },
      data: { crt },
    });

    // Step B: Find Best Slots (Capacity Aware)
    const slots = await this.findCapacityAwareSlots(crt, request.priority);

    if (slots.length === 0) {
      this.logger.warn(`No slots available for Request ${requestId}`);
      // Handle logic for no slots (omitted for demo)
      return null;
    }

    // Pick the best slot (Logic: Lowest Risk Score)
    const bestSlot = slots.sort((a, b) => a.riskScore - b.riskScore)[0];

    // Step C: Save Recommendation
    const recommendation = await this.prisma.recommendation.upsert({
      where: { requestId: request.id },
      create: {
        requestId: request.id,
        slotStart: bestSlot.start,
        slotEnd: bestSlot.end,
        routeJson: { steps: ['Gate A', 'Zone B', 'Gate Out'] }, // Demo route
        riskScore: bestSlot.riskScore,
        explanation: bestSlot.explanation,
      },
      update: {
        slotStart: bestSlot.start,
        slotEnd: bestSlot.end,
        riskScore: bestSlot.riskScore,
        explanation: bestSlot.explanation,
      },
    });

    // Update Request Status
    await this.prisma.pickupRequest.update({
      where: { id: request.id },
      data: { status: RequestStatus.RECOMMENDED },
    });

    return recommendation;
  }

  // --- 2. Algorithms (Demo Rules) ---

  private async predictCRT(container: any): Promise<Date> {
    // Rule: CRT = Vessel ETA + Discharge Time (4h) + Yard Shuffle (Random 1-6h)
    const eta = new Date(container.vessel.eta);
    const dischargeHours = 4;
    const yardShuffleHours = Math.floor(Math.random() * 6) + 1;
    
    // Nếu container REEFER thì ưu tiên làm lạnh -> lâu hơn chút
    const reeferFactor = container.isReefer ? 2 : 0;

    const totalDelay = dischargeHours + yardShuffleHours + reeferFactor;
    return new Date(eta.getTime() + totalDelay * 60 * 60 * 1000);
  }

  private async findCapacityAwareSlots(crt: Date, isPriority: boolean) {
    // Tìm các slot gate mở sau thời điểm CRT trong vòng 48h tới
    const endWindow = new Date(crt.getTime() + 48 * 60 * 60 * 1000);

    const capacities = await this.prisma.gateCapacity.findMany({
      where: {
        startTime: { gte: crt, lte: endWindow },
        status: 'OPEN',
      },
      orderBy: { startTime: 'asc' },
      take: 10, // Lấy 10 slot gần nhất
    });

    // Map capacity to scored slots
    return capacities.map((cap) => {
      let riskScore = 0;
      let explanation = 'Optimal slot.';

      // Factor 1: Peak Hour
      if (cap.isPeakHour) {
        riskScore += 40;
        explanation = 'High risk due to Peak Hour congestion.';
      }

      // Factor 2: Capacity Utilization
      const utilization = cap.usedSlots / cap.maxSlots;
      riskScore += utilization * 50; // Max 50 points

      // Factor 3: Priority Handling
      if (isPriority && cap.isPeakHour) {
        riskScore -= 20; // Priority requests tolerate peak hours better
        explanation += ' (Mitigated by Priority status)';
      }

      // Skip if full
      if (cap.usedSlots >= cap.maxSlots) {
        riskScore = 100;
        explanation = 'Slot FULL.';
      }

      return {
        start: cap.startTime,
        end: cap.endTime,
        riskScore: Math.min(riskScore, 100),
        explanation,
      };
    });
  }

  // --- 3. Re-optimization Trigger ---

  async triggerDisruptionReoptimization(disruptionId: string) {
    // Add job to queue
    await this.orchestrationQueue.add('reoptimize-impacted', { disruptionId });
    this.logger.log(`Queued re-optimization for Disruption ${disruptionId}`);
  }

  // Logic thực thi bởi Processor
  async reoptimizeImpactedBookings(disruptionId: string) {
    const disruption = await this.prisma.disruption.findUnique({
      where: { id: disruptionId },
    });
    if (!disruption) return;

    this.logger.log(`Running Re-optimization for: ${disruption.description}`);

    // 1. Find impacted bookings (Container nằm trong affectedZones)
    // Demo: Tìm các booking có container có yardZone trùng với disruption.affectedZones
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        request: {
          container: {
            yardZone: { in: disruption.affectedZones },
          },
        },
      },
      include: { request: true },
    });

    this.logger.log(`Found ${bookings.length} impacted bookings.`);

    // 2. Reschedule Loop
    for (const booking of bookings) {
      // Demo Action: Đẩy lùi lịch 2 tiếng và đổi trạng thái
      const newStart = new Date(booking.confirmedSlotStart.getTime() + 2 * 60 * 60 * 1000);
      const newEnd = new Date(booking.confirmedSlotEnd.getTime() + 2 * 60 * 60 * 1000);

      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.RESCHEDULED,
          confirmedSlotStart: newStart,
          confirmedSlotEnd: newEnd,
          blockedReason: `Rescheduled due to ${disruption.type}`,
        },
      });

      // 3. Notify User
      const userId = await this.getUserIdByCompany(booking.request.companyId);
      if (userId) {
        await this.prisma.notification.create({
          data: {
            userId,
            title: 'Booking Rescheduled ⚠️',
            message: `Your booking for container ${booking.request.containerId} was moved +2h due to ${disruption.type}.`,
            type: 'WARNING',
          },
        });
      }
    }
  }
  
  private async getUserIdByCompany(companyId: string) {
      const user = await this.prisma.user.findFirst({ where: { companyId }});
      return user?.id;
  }
}
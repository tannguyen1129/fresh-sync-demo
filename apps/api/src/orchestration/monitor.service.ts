import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';
import { EVENTS, CongestionUpdatePayload } from '@freshsync/shared';

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventsGateway
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS) // Demo: 5s update 1 lần
  async broadcastCongestion() {
    const activeDisruptions = await this.prisma.disruption.count({
      where: { isActive: true }
    });
    const now = new Date();
    const gateCap = await this.prisma.gateCapacity.findFirst({
      where: {
        startTime: { lte: now },
        endTime: { gt: now },
      },
    });
    const yardStatuses = await this.prisma.yardStatus.findMany();
    const yardOccupancy = Object.fromEntries(
      yardStatuses.map((yard) => [yard.zoneId, Math.round(yard.occupancyPct)])
    );

    const payload: CongestionUpdatePayload = {
      timestamp: now.toISOString(),
      gateLoad: gateCap ? Math.round((gateCap.usedSlots / gateCap.maxSlots) * 100) : 0,
      yardOccupancy,
      activeDisruptions
    };

    this.events.emit(EVENTS.CONGESTION_UPDATED, payload);
  }
}

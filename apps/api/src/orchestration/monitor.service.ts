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
    // 1. Calculate Metrics (Simplified)
    const activeDisruptions = await this.prisma.disruption.count({
        where: { isActive: true }
    });
    
    // Demo data for chart
    const payload: CongestionUpdatePayload = {
        timestamp: new Date().toISOString(),
        gateLoad: Math.floor(Math.random() * 30) + 50, // Random 50-80%
        yardOccupancy: {
            'ZONE_A': 45,
            'ZONE_B': 88, // Congested
        },
        activeDisruptions
    };

    this.events.emit(EVENTS.CONGESTION_UPDATED, payload);
  }
}
import { Controller, Get, Query } from '@nestjs/common';
import { HealthCheckResponse, HealthCheckSchema } from '@freshsync/shared';
import { Public } from './auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

const PORT_TERMINALS = [
  { code: 'TML-A', name: 'Terminal A (Tan Cang)', gate: 'GATE_1', zone: 'ZONE_A', lat: 10.7761, lng: 106.7909 },
  { code: 'TML-B', name: 'Terminal B (Cat Lai)', gate: 'GATE_2', zone: 'ZONE_B', lat: 10.7792, lng: 106.7992 },
  { code: 'TML-R', name: 'Reefer Yard', gate: 'GATE_COLD', zone: 'ZONE_REEFER', lat: 10.7715, lng: 106.8052 },
];

const GATE_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  GATE_1: { lat: 10.7749, lng: 106.7894, label: 'Gate 1 (North)' },
  GATE_2: { lat: 10.7778, lng: 106.7974, label: 'Gate 2 (South)' },
  GATE_COLD: { lat: 10.7703, lng: 106.8043, label: 'Cold Gate' },
};

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get('health')
  @Public()
  getHealth(): HealthCheckResponse {
    const response: HealthCheckResponse = {
      ok: true,
      service: 'FreshSync API',
      timestamp: new Date().toISOString()
    };
    
    // Validate response using shared Zod schema (optional demo)
    return HealthCheckSchema.parse(response);
  }

  @Get('demo/status')
  @Public()
  async getDemoStatus() {
    let db = 'down';
    let redis = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch {
      db = 'down';
    }

    const redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await redisClient.connect();
      const pong = await redisClient.ping();
      redis = pong === 'PONG' ? 'ok' : 'down';
    } catch {
      redis = 'down';
    } finally {
      redisClient.disconnect();
    }

    return {
      api: 'ok',
      db,
      redis,
      seedVersion: 'freshsync-demo-v2',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('meta/demo-data')
  @Public()
  async getDemoData(@Query('q') q?: string) {
    const search = q?.trim().toUpperCase();
    const where = search
      ? {
          OR: [
            { containerNo: { contains: search } },
            { yardZone: { contains: search } },
          ],
        }
      : {};

    const [containers, drivers, depots, capacities, yardStatuses] = await Promise.all([
      this.prisma.container.findMany({
        where,
        include: { deliveryOrder: true },
        orderBy: { containerNo: 'asc' },
        take: 20,
      }),
      this.prisma.driver.findMany({
        where: { status: { not: 'OFFLINE' } },
        orderBy: { name: 'asc' },
        take: 12,
      }),
      this.prisma.depot.findMany({
        orderBy: { name: 'asc' },
      }),
      this.prisma.gateCapacity.findMany({
        where: {
          startTime: { gte: new Date() },
        },
        orderBy: { startTime: 'asc' },
        take: 4,
      }),
      this.prisma.yardStatus.findMany({
        orderBy: { zoneId: 'asc' },
      }),
    ]);

    const terminals = [
      { code: 'TML-A', name: 'Terminal A', gate: 'GATE_1', zone: 'ZONE_A' },
      { code: 'TML-B', name: 'Terminal B', gate: 'GATE_2', zone: 'ZONE_B' },
      { code: 'TML-R', name: 'Reefer Yard', gate: 'GATE_COLD', zone: 'ZONE_REEFER' },
    ];

    const gates = capacities.map((capacity, index) => ({
      id: `GATE_${index + 1}`,
      startTime: capacity.startTime,
      endTime: capacity.endTime,
      maxSlots: capacity.maxSlots,
      usedSlots: capacity.usedSlots,
      status: capacity.status,
      isPeakHour: capacity.isPeakHour,
    }));

    return {
      terminals,
      gates,
      yardStatuses,
      depots,
      drivers: drivers.map((driver) => ({
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        licensePlate: driver.licensePlate,
        status: driver.status,
      })),
      containers: containers.map((container) => ({
        id: container.id,
        containerNo: container.containerNo,
        sizeType: container.sizeType,
        doStatus: container.deliveryOrder?.status ?? null,
        readiness: container.status,
        yardZone: container.yardZone,
        crt: container.crt,
        isReefer: container.isReefer,
      })),
    };
  }

  @Get('meta/port-map-snapshot')
  async getPortMapSnapshot(@Query('companyId') companyId?: string) {
    const now = new Date();

    const [yardStatuses, capacities, recentCapacities, disruptions, assignments, depots] = await Promise.all([
      this.prisma.yardStatus.findMany({ orderBy: { zoneId: 'asc' } }),
      this.prisma.gateCapacity.findMany({
        where: { startTime: { gte: now } },
        take: 4,
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.gateCapacity.findMany({
        where: {
          startTime: {
            gte: new Date(now.getTime() - 6 * 60 * 60 * 1000),
            lte: new Date(now.getTime() + 6 * 60 * 60 * 1000),
          },
        },
        orderBy: { startTime: 'asc' },
        take: 12,
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
          ...(companyId
            ? {
                booking: {
                  request: { companyId },
                },
              }
            : {}),
        },
        include: {
          driver: true,
          booking: {
            include: {
              request: {
                include: { container: true, company: true },
              },
            },
          },
        },
        take: 30,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.depot.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const gates = capacities.map((capacity, index) => {
      const gateId = index === 1 ? 'GATE_2' : index === 2 ? 'GATE_COLD' : 'GATE_1';
      const coord = GATE_COORDS[gateId];
      return {
        id: gateId,
        label: coord.label,
        usedSlots: capacity.usedSlots,
        maxSlots: capacity.maxSlots,
        status: capacity.status,
        isPeakHour: capacity.isPeakHour,
        utilizationPct: Math.round((capacity.usedSlots / Math.max(capacity.maxSlots, 1)) * 100),
        timeWindow: { start: capacity.startTime, end: capacity.endTime },
        lat: coord.lat,
        lng: coord.lng,
      };
    });

    const trucks = assignments.map((assignment, index) => {
      const containerNo = assignment.booking.request.container.containerNo;
      const yardZone = assignment.booking.request.container.yardZone ?? 'ZONE_A';
      const terminal = PORT_TERMINALS.find((item) => item.zone === yardZone) ?? PORT_TERMINALS[0];
      const driverLat = assignment.driver.currentLat;
      const driverLng = assignment.driver.currentLng;
      const fallbackLat = terminal.lat - 0.012 + ((index * 0.0021) % 0.018);
      const fallbackLng = terminal.lng - 0.018 + ((index * 0.0034) % 0.026);
      return {
        assignmentId: assignment.id,
        driverName: assignment.driver.name,
        licensePlate: assignment.driver.licensePlate,
        containerNo,
        sizeType: assignment.booking.request.container.sizeType,
        type: assignment.type,
        status: assignment.status,
        gate: assignment.booking.assignedGate ?? (assignment.routeJson as any)?.gate ?? 'GATE_1',
        terminalCode: assignment.booking.terminalCode ?? terminal.code,
        companyName: assignment.booking.request.company.name,
        lat: driverLat ?? fallbackLat,
        lng: driverLng ?? fallbackLng,
        slotStart: assignment.booking.confirmedSlotStart,
        slotEnd: assignment.booking.confirmedSlotEnd,
      };
    });

    const recentUtilization = recentCapacities.map((capacity) => ({
      time: capacity.startTime.toISOString(),
      hour: `${String(capacity.startTime.getHours()).padStart(2, '0')}:00`,
      utilizationPct: Math.round((capacity.usedSlots / Math.max(capacity.maxSlots, 1)) * 100),
      isPeakHour: capacity.isPeakHour,
    }));

    return {
      updatedAt: now.toISOString(),
      center: { lat: 10.7756, lng: 106.7961 },
      terminals: PORT_TERMINALS,
      gates,
      yardStatuses: yardStatuses.map((yard) => ({
        zoneId: yard.zoneId,
        occupancyPct: Math.round(yard.occupancyPct),
      })),
      depots: depots.map((depot) => ({
        id: depot.id,
        name: depot.name,
        lat: depot.lat,
        lng: depot.lng,
        capacity: depot.capacity,
        currentLoad: depot.currentLoad,
        loadPct: Math.round((depot.currentLoad / Math.max(depot.capacity, 1)) * 100),
        status: depot.status,
      })),
      disruptions: disruptions.map((disruption) => ({
        id: disruption.id,
        type: disruption.type,
        severity: disruption.severity,
        description: disruption.description,
        affectedZones: disruption.affectedZones,
      })),
      trucks,
      recentUtilization,
    };
  }
}

import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  Logger 
} from '@nestjs/common';
import { DriverStatus as PrismaDriverStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  UpdateAssignmentStatusDto, 
  QrCheckInDto,
  StartReturnEmptyDto, 
  AssignmentStatus, 
  AssignmentType,
  EVENTS,
  DriverAssignmentPayload
} from '@freshsync/shared';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);
  private readonly pickupTransitions: Partial<Record<AssignmentStatus, AssignmentStatus>> = {
    [AssignmentStatus.NEW]: AssignmentStatus.ENROUTE,
    [AssignmentStatus.ENROUTE]: AssignmentStatus.ARRIVED_GATE,
    [AssignmentStatus.ARRIVED_GATE]: AssignmentStatus.PICKED_UP,
    [AssignmentStatus.PICKED_UP]: AssignmentStatus.DEPARTED,
    [AssignmentStatus.DEPARTED]: AssignmentStatus.DELIVERED,
  };
  private readonly returnTransitions: Partial<Record<AssignmentStatus, AssignmentStatus>> = {
    [AssignmentStatus.NEW]: AssignmentStatus.RETURN_EMPTY_STARTED,
    [AssignmentStatus.RETURN_EMPTY_STARTED]: AssignmentStatus.RETURNED,
  };

  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  // --- 1. Get Assignments ---
  async getMyAssignments(driverId: string) {
    // Tìm driver record dựa trên userId (đã link ở Auth)
    const driver = await this.prisma.driver.findFirst({
        where: { id: driverId }
    });

    if(!driver) throw new NotFoundException('Driver profile not found');

    const assignments = await this.prisma.assignment.findMany({
      where: {
        driverId: driver.id,
        status: {
          not: AssignmentStatus.RETURNED
        }
      },
      include: {
        driver: true,
        booking: {
          include: {
            assignments: {
              select: {
                id: true,
                type: true,
                status: true,
              },
            },
            request: {
              include: { container: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return assignments.filter((assignment) => {
      if (assignment.type !== AssignmentType.PICKUP || assignment.status !== AssignmentStatus.DELIVERED) {
        return true;
      }

      // Keep a delivered pickup visible only until the return-empty job is created.
      const hasReturnAssignment = assignment.booking.assignments.some(
        (candidate) => candidate.type === AssignmentType.RETURN_EMPTY,
      );
      return !hasReturnAssignment;
    });
  }

  async getTodayTasks(driverId: string) {
    const assignments = await this.getMyAssignments(driverId);
    return assignments.map((assignment) => ({
      assignmentId: assignment.id,
      bookingId: assignment.bookingId,
      bookingCode: assignment.booking.bookingCode,
      containerNo: assignment.booking.request.container.containerNo,
      containerType: assignment.booking.request.container.sizeType,
      terminalCode: assignment.booking.terminalCode,
      gate: assignment.booking.assignedGate,
      slotStart: assignment.booking.confirmedSlotStart,
      slotEnd: assignment.booking.confirmedSlotEnd,
      status: assignment.status,
      type: assignment.type,
      checkInStatus: assignment.booking.checkInStatus,
      qrReady: Boolean(assignment.booking.qrToken),
      routeJson: assignment.routeJson,
    }));
  }

  // --- 2. Update Status (Tracking) ---
  async updateStatus(assignmentId: string, dto: UpdateAssignmentStatusDto) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
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
    });

    if (!assignment) throw new NotFoundException('Assignment not found');
    this.assertValidTransition(
      assignment.type as unknown as AssignmentType,
      assignment.status as unknown as AssignmentStatus,
      dto.status,
    );

    const updateData: any = { status: dto.status };
    const now = new Date();
    const driverStatus =
      dto.status === AssignmentStatus.RETURNED ? PrismaDriverStatus.IDLE :
      dto.status === AssignmentStatus.NEW ? undefined :
      PrismaDriverStatus.BUSY;

    switch (dto.status) {
      case AssignmentStatus.ENROUTE:
      case AssignmentStatus.RETURN_EMPTY_STARTED:
        updateData.etaToGate = new Date(now.getTime() + 25 * 60 * 1000);
        break;
      case AssignmentStatus.ARRIVED_GATE:
        updateData.actualIn = now;
        break;
      case AssignmentStatus.DEPARTED:
        updateData.actualOut = now;
        break;
    }

    if (dto.lat !== undefined && dto.lng !== undefined) {
      updateData.routeJson = {
        ...(assignment.routeJson as Record<string, unknown> | null ?? {}),
        currentLat: dto.lat,
        currentLng: dto.lng,
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lat !== undefined && dto.lng !== undefined || driverStatus) {
        await tx.driver.update({
          where: { id: assignment.driverId },
          data: {
            ...(dto.lat !== undefined && dto.lng !== undefined ? { currentLat: dto.lat, currentLng: dto.lng } : {}),
            ...(driverStatus ? { status: driverStatus } : {}),
          },
        });
      }

      if (assignment.type === AssignmentType.PICKUP && dto.status === AssignmentStatus.DEPARTED) {
        await tx.container.update({
          where: { id: assignment.booking.request.container.id },
          data: { status: 'GATE_OUT' },
        });
      }

      if (assignment.type === AssignmentType.RETURN_EMPTY && dto.status === AssignmentStatus.RETURNED) {
        await tx.container.update({
          where: { id: assignment.booking.request.container.id },
          data: { status: 'RETURNED' },
        });
      }

      if (assignment.type === AssignmentType.PICKUP && dto.status === AssignmentStatus.ARRIVED_GATE) {
        await tx.booking.update({
          where: { id: assignment.bookingId },
          data: { checkInStatus: 'AT_GATE' },
        });
      }

      return tx.assignment.update({
        where: { id: assignmentId },
        data: updateData,
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
      });
    });

    this.logger.log(`Assignment ${assignmentId} updated to ${dto.status}`);

    const locationName =
      updated.type === AssignmentType.RETURN_EMPTY
        ? String((updated.routeJson as any)?.destination ?? 'Depot')
        : String((updated.routeJson as any)?.gate ?? (updated.routeJson as any)?.steps?.[1] ?? 'Port Gate');
    const payload: DriverAssignmentPayload = {
      assignmentId: updated.id,
      bookingId: updated.bookingId,
      type: updated.type as unknown as AssignmentType,
      status: updated.status as unknown as AssignmentStatus,
      containerNo: updated.booking.request.container.containerNo,
      driverName: updated.driver.name,
      licensePlate: updated.driver.licensePlate,
      location: {
        name: locationName,
        lat: Number((updated.routeJson as any)?.lat ?? (updated.routeJson as any)?.currentLat ?? 10.77),
        lng: Number((updated.routeJson as any)?.lng ?? (updated.routeJson as any)?.currentLng ?? 106.78),
      },
      timeWindow: {
        start: updated.booking.confirmedSlotStart.toISOString(),
        end: updated.booking.confirmedSlotEnd.toISOString(),
      },
      updatedAt: updated.updatedAt.toISOString(),
    };

    this.events.emit(EVENTS.DRIVER_ASSIGNMENT_UPDATED, payload);
    return updated;
  }

  async checkInBooking(driverId: string, bookingId: string, dto: QrCheckInDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        request: {
          include: { container: true },
        },
        assignments: {
          include: { driver: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    const activeAssignment = booking.assignments.find((assignment) => assignment.driverId === driverId);
    if (!activeAssignment) {
      throw new BadRequestException('This booking is not assigned to the current driver.');
    }

    if (!booking.qrToken || booking.qrToken !== dto.qrToken) {
      throw new BadRequestException('Invalid QR token for this booking.');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          checkInStatus: 'CHECKED_IN',
          checkInAt: now,
        },
      });

      const updatedAssignment =
        activeAssignment.type === AssignmentType.PICKUP && activeAssignment.status === AssignmentStatus.ENROUTE
          ? await tx.assignment.update({
              where: { id: activeAssignment.id },
              data: {
                status: AssignmentStatus.ARRIVED_GATE,
                actualIn: now,
              },
            })
          : activeAssignment;

      return { updatedBooking, updatedAssignment };
    });

    return {
      booking: updated.updatedBooking,
      assignment: updated.updatedAssignment,
      qrValidated: true,
      checkedInAt: now.toISOString(),
      containerNo: booking.request.container.containerNo,
    };
  }

  async getTaskQr(driverId: string, assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
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
    });

    if (!assignment || assignment.driverId !== driverId) {
      throw new NotFoundException('Task not found');
    }

    return {
      assignmentId: assignment.id,
      bookingId: assignment.bookingId,
      bookingCode: assignment.booking.bookingCode,
      containerNo: assignment.booking.request.container.containerNo,
      terminalCode: assignment.booking.terminalCode,
      assignedGate: assignment.booking.assignedGate,
      qrToken: assignment.booking.qrToken,
      checkInStatus: assignment.booking.checkInStatus,
      checkInAt: assignment.booking.checkInAt,
      slotStart: assignment.booking.confirmedSlotStart,
      slotEnd: assignment.booking.confirmedSlotEnd,
      driverName: assignment.driver.name,
      licensePlate: assignment.driver.licensePlate,
    };
  }

  // --- 3. Smart Empty Return Optimization ---
  async requestEmptyReturn(driverId: string, dto: StartReturnEmptyDto) {
    // A. Lấy thông tin Assignment cũ để biết Container nào
    const prevAssignment = await this.prisma.assignment.findUnique({
      where: { id: dto.assignmentId },
      include: { 
          booking: { 
              include: { 
                  request: { include: { container: { include: { returnInstruction: true } } } } 
              } 
          },
          driver: true
      }
    });

    if (!prevAssignment) throw new NotFoundException('Previous assignment not found');
    if (prevAssignment.driverId !== driverId) {
      throw new BadRequestException('Assignment does not belong to the current driver.');
    }
    if (prevAssignment.type !== AssignmentType.PICKUP || prevAssignment.status !== AssignmentStatus.DELIVERED) {
      throw new BadRequestException('Empty return can only start after the pickup assignment is delivered.');
    }
    
    const container = prevAssignment.booking.request.container;
    const instruction = container.returnInstruction;

    if (!instruction) {
      throw new BadRequestException('No empty return instruction found for this container. Please contact Ops.');
    }

    const existingReturnAssignment = await this.prisma.assignment.findFirst({
      where: {
        bookingId: prevAssignment.bookingId,
        type: AssignmentType.RETURN_EMPTY,
        status: {
          not: AssignmentStatus.RETURNED,
        },
      },
    });

    if (existingReturnAssignment) {
      throw new BadRequestException('A return-empty assignment is already active for this booking.');
    }

    // B. Lấy danh sách Depot cho phép
    // instruction.allowedDepots là mảng tên hoặc ID (VD: ["Depot A", "Depot B"])
    const allowedDepots = await this.prisma.depot.findMany({
      where: {
        name: { in: instruction.allowedDepots },
        status: 'OPEN' // Chỉ lấy depot đang mở
      }
    });

    if (allowedDepots.length === 0) {
       throw new BadRequestException('All allowed depots are closed or unavailable.');
    }

    // C. Thuật toán tối ưu (Scoring)
    // Score = Distance (km) + (Load % * Weight)
    // Càng thấp càng tốt
    const scoredDepots = allowedDepots.map(depot => {
        const distanceKm = this.calculateDistance(
            dto.currentLat, 
            dto.currentLng, 
            depot.lat, 
            depot.lng
        );
        
        const loadFactor = depot.currentLoad / depot.capacity; // 0.0 - 1.0 (hoặc hơn)
        const trafficScore = this.getTrafficScore(depot.name);
        const score = distanceKm + (loadFactor * 10) + trafficScore;

        return {
            ...depot,
            distanceKm,
            loadPct: Math.round(loadFactor * 100),
            trafficScore,
            score
        };
    });

    // Sort lấy Score thấp nhất
    scoredDepots.sort((a, b) => a.score - b.score);
    const bestDepot = scoredDepots[0];

    // D. Tạo Assignment mới: RETURN_EMPTY
    // Cần tạo 1 Booking ảo hoặc dùng lại booking cũ? 
    // Tốt nhất tạo Assignment mới link vào Booking cũ nhưng đổi type.
    
    const returnAssignment = await this.prisma.assignment.create({
      data: {
        bookingId: prevAssignment.bookingId, // Link chung booking
        driverId: prevAssignment.driverId,
        type: AssignmentType.RETURN_EMPTY,
        status: AssignmentStatus.NEW,
        // Route trả về Depot tối ưu
        routeJson: { 
            destination: bestDepot.name, 
            lat: bestDepot.lat, 
            lng: bestDepot.lng,
            distance: bestDepot.distanceKm.toFixed(2) + ' km',
            utilizationPct: bestDepot.loadPct,
            estimatedMinutes: Math.max(12, Math.round(bestDepot.distanceKm * 2.5)),
            trafficLevel: this.getTrafficLevel(bestDepot.name),
        }
      }
    });

    const payload: DriverAssignmentPayload = {
      assignmentId: returnAssignment.id,
      bookingId: prevAssignment.bookingId,
      type: returnAssignment.type as unknown as AssignmentType,
      status: returnAssignment.status as unknown as AssignmentStatus,
      containerNo: container.containerNo,
      driverName: prevAssignment.driver.name,
      licensePlate: prevAssignment.driver.licensePlate,
      location: {
        name: bestDepot.name,
        lat: bestDepot.lat,
        lng: bestDepot.lng,
      },
      timeWindow: {
        start: prevAssignment.booking.confirmedSlotStart.toISOString(),
        end: prevAssignment.booking.confirmedSlotEnd.toISOString(),
      },
      updatedAt: returnAssignment.updatedAt.toISOString(),
    };

    this.events.emit(EVENTS.DRIVER_ASSIGNMENT_CREATED, payload);

    return {
        assignment: returnAssignment,
        recommendation: {
            depotName: bestDepot.name,
            containerNo: container.containerNo,
            distance: bestDepot.distanceKm,
            utilizationPct: bestDepot.loadPct,
            estimatedMinutes: Math.max(12, Math.round(bestDepot.distanceKm * 2.5)),
            trafficLevel: this.getTrafficLevel(bestDepot.name),
            reason: `${bestDepot.name} selected because it is ${bestDepot.distanceKm.toFixed(1)} km away, currently at ${bestDepot.loadPct}% capacity, and has ${this.getTrafficLevel(bestDepot.name).toLowerCase()} traffic.`
        },
        candidates: scoredDepots.map((depot) => ({
          name: depot.name,
          status: depot.status,
          distance: Number(depot.distanceKm.toFixed(2)),
          utilizationPct: depot.loadPct,
          estimatedMinutes: Math.max(12, Math.round(depot.distanceKm * 2.5)),
          trafficLevel: this.getTrafficLevel(depot.name),
          reason:
            depot.name === bestDepot.name
              ? 'Best score'
              : `${depot.distanceKm.toFixed(1)} km away, ${depot.loadPct}% loaded`,
        })),
    };
  }

  private assertValidTransition(type: AssignmentType, currentStatus: AssignmentStatus, nextStatus: AssignmentStatus) {
    const transitions = type === AssignmentType.RETURN_EMPTY ? this.returnTransitions : this.pickupTransitions;
    const allowedNext = transitions[currentStatus];
    if (allowedNext !== nextStatus) {
      throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${nextStatus}.`);
    }
  }

  private getTrafficLevel(depotName: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (depotName.includes('Cat Lai')) return 'HIGH';
    if (depotName.includes('Thu Duc') || depotName.includes('Phu Huu')) return 'MEDIUM';
    return 'LOW';
  }

  private getTrafficScore(depotName: string): number {
    const trafficLevel = this.getTrafficLevel(depotName);
    if (trafficLevel === 'HIGH') return 12;
    if (trafficLevel === 'MEDIUM') return 5;
    return 0;
  }

  // --- Helper: Haversine Distance ---
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

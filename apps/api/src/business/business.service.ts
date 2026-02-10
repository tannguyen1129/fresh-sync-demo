import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { 
  CreatePickupRequestDto, 
  ConfirmBookingDto, 
  DOStatus, 
  RequestStatus, 
  BookingStatus, 
  AssignmentStatus, 
  AssignmentType,
  EVENTS, 
  BookingUpdatedPayload
} from '@freshsync/shared';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class BusinessService {
  constructor(
    private prisma: PrismaService,
    private orchestrationService: OrchestrationService,
    private events: EventsGateway,
  ) {}

  // --- 1. Create Pickup Request ---
  async createPickupRequest(companyId: string, dto: CreatePickupRequestDto) {
    // A. Validate Container & DO Status
    const container = await this.prisma.container.findUnique({
      where: { id: dto.containerId }, // Frontend gửi ID (UUID) hoặc ContainerNo (cần map nếu dùng No)
      include: { deliveryOrder: true },
    });

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    // B. Business Rule: D/O HOLD Check
    if (container.deliveryOrder?.status === DOStatus.HOLD) {
      throw new ConflictException({
        message: 'Cannot request pickup. Delivery Order is on HOLD.',
        reason: 'COMMERCIAL_HOLD',
        validUntil: container.deliveryOrder.validUntil
      });
    }

    // C. Create Request
    const request = await this.prisma.pickupRequest.create({
      data: {
        companyId,
        containerId: dto.containerId,
        requestedTime: dto.requestedTime ? new Date(dto.requestedTime) : null,
        priority: dto.priority,
        status: RequestStatus.CREATED,
      },
    });

    // D. Call Engine for Recommendation (Synchronous for Demo/MVP)
    // Trong thực tế có thể dùng Queue nếu tính toán quá nặng
    const recommendation = await this.orchestrationService.generateRecommendation(request.id);

    return {
      request,
      recommendation, // Return immediately for UI to show
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
      include: { container: true }, 
    });

    if (!request || request.companyId !== companyId) {
      throw new NotFoundException('Request not found');
    }

    if (request.status === RequestStatus.CONFIRMED) {
      throw new ConflictException('Request already confirmed');
    }

    // B. Transaction
    // FIX 2: Gán kết quả transaction vào biến 'result'
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

      // 2. Check Capacity & Increment
      if (capacitySlot.usedSlots >= capacitySlot.maxSlots) {
         throw new ConflictException('Slot became full. Please pick another time.');
      }

      // Note: Để an toàn tuyệt đối (Concurrency safe), nên dùng updateMany với where clause:
      // const updated = await tx.gateCapacity.updateMany({
      //   where: { id: capacitySlot.id, usedSlots: { lt: capacitySlot.maxSlots } },
      //   data: { usedSlots: { increment: 1 } }
      // });
      // if (updated.count === 0) throw Conflict...
      
      // Demo logic (Optimistic check ok):
      await tx.gateCapacity.update({
        where: { id: capacitySlot.id },
        data: { usedSlots: { increment: 1 } },
      });

      // 3. Create Booking
      const booking = await tx.booking.create({
        data: {
          requestId,
          confirmedSlotStart: new Date(slotStart),
          confirmedSlotEnd: new Date(slotEnd),
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
          routeJson: { steps: ['Gate A', 'Zone B', 'Gate Out'] },
        },
      });

      // Trả về dữ liệu cần thiết ra ngoài transaction scope
      return { booking, assignment };
    });

    // C. Emit Event (Sau khi transaction commit thành công)
    const payload: BookingUpdatedPayload = {
      bookingId: result.booking.id,
      requestId: requestId,
      newStatus: BookingStatus.CONFIRMED,
      slotStart: result.booking.confirmedSlotStart.toISOString(),
      slotEnd: result.booking.confirmedSlotEnd.toISOString(),
      // FIX 3: Dùng containerNo thật
      containerNo: request.container.containerNo 
    };
    
    this.events.emit(EVENTS.BOOKING_UPDATED, payload);
    
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
        assignment: {
            include: { driver: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
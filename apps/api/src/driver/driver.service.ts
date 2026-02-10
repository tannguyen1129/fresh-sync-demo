import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  Logger 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  UpdateAssignmentStatusDto, 
  StartReturnEmptyDto, 
  AssignmentStatus, 
  AssignmentType 
} from '@freshsync/shared';

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);

  constructor(private prisma: PrismaService) {}

  // --- 1. Get Assignments ---
  async getMyAssignments(driverId: string) {
    // Tìm driver record dựa trên userId (đã link ở Auth)
    const driver = await this.prisma.driver.findFirst({
        where: { id: driverId }
    });

    if(!driver) throw new NotFoundException('Driver profile not found');

    return this.prisma.assignment.findMany({
      where: {
        driverId: driver.id,
        status: {
          notIn: [AssignmentStatus.DELIVERED, AssignmentStatus.RETURNED] // Chỉ lấy job chưa hoàn thành
        }
      },
      include: {
        booking: {
          include: {
            request: {
              include: { container: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  // --- 2. Update Status (Tracking) ---
  async updateStatus(assignmentId: string, dto: UpdateAssignmentStatusDto) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    // Logic update timestamp dựa trên status
    const updateData: any = { status: dto.status };
    const now = new Date();

    // Map status to specific timestamp fields
    switch (dto.status) {
      case AssignmentStatus.ARRIVED_GATE:
        updateData.actualIn = now;
        break;
      case AssignmentStatus.DEPARTED:
        updateData.actualOut = now;
        break;
      // Các status khác (ENROUTE, PICKED_UP) chỉ update status & updatedAt
    }

    // Nếu driver gửi kèm toạ độ, update vị trí driver luôn
    if (dto.lat && dto.lng) {
        await this.prisma.driver.update({
            where: { id: assignment.driverId },
            data: { currentLat: dto.lat, currentLng: dto.lng }
        });
    }

    const updated = await this.prisma.assignment.update({
      where: { id: assignmentId },
      data: updateData,
    });

    this.logger.log(`Assignment ${assignmentId} updated to ${dto.status}`);
    
    // TODO: Emit Socket event 'driver.assignment.updated' here
    return updated;
  }

  // --- 3. Smart Empty Return Optimization ---
  async requestEmptyReturn(driverUserId: string, dto: StartReturnEmptyDto) {
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
    
    const container = prevAssignment.booking.request.container;
    const instruction = container.returnInstruction;

    if (!instruction) {
      throw new BadRequestException('No empty return instruction found for this container. Please contact Ops.');
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
        
        // Công thức demo: 1km = 1 điểm. Full load (100%) = cộng thêm 10 điểm (tương đương đi xa thêm 10km)
        // Mục tiêu: Tránh Depot quá tải trừ khi nó rất gần.
        const score = distanceKm + (loadFactor * 10);

        return {
            ...depot,
            distanceKm,
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
            distance: bestDepot.distanceKm.toFixed(2) + ' km'
        }
      }
    });

    return {
        assignment: returnAssignment,
        recommendation: {
            depotName: bestDepot.name,
            distance: bestDepot.distanceKm,
            reason: `Optimal depot selected based on distance (${bestDepot.distanceKm.toFixed(1)}km) and utilization.`
        }
    };
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
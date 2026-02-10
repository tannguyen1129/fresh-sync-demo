import { Injectable, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '@freshsync/shared';

@Injectable()
export class EsgService {
  constructor(private prisma: PrismaService) {}

  // --- 1. Generate Report for a specific date ---
  async generateDailyReport(dateString: string) {
    const date = new Date(dateString);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    // A. Lấy dữ liệu Booking trong ngày
    const bookings = await this.prisma.booking.findMany({
      where: {
        updatedAt: { gte: startOfDay, lte: endOfDay },
        status: { not: BookingStatus.CANCELLED }
      },
      include: { request: true }
    });

    const totalBookings = bookings.length;
    if (totalBookings === 0) {
        return { message: "No bookings found for this date." };
    }

    // B. Tính toán Metrics (Demo Logic)
    
    // 1. Peak Avoided:
    // - Đếm số booking bị RESCHEDULED (do hệ thống dời lịch)
    // - Cộng thêm 15% booking thành công (giả lập thuật toán tự động chọn slot tốt ngay từ đầu)
    const rescheduledCount = bookings.filter(b => b.status === BookingStatus.RESCHEDULED).length;
    const optimizedCount = Math.floor(totalBookings * 0.15); 
    const peakAvoided = rescheduledCount + optimizedCount;

    // 2. Idle Time Saved (Giả định):
    // - 1 Peak Avoided = Tiết kiệm 45 phút chờ đợi tại cổng/bãi
    const idleTimeSavedMin = peakAvoided * 45;

    // 3. CO2 Reduced (Giả định):
    // - Xe tải idling thải ra ~2.6kg CO2/giờ -> 0.043kg/phút
    const co2ReducedKg = parseFloat((idleTimeSavedMin * 0.043).toFixed(2));

    // C. Lưu vào DB (Upsert)
    // Prisma Date so sánh chính xác timestamp, nên ta dùng dateString (YYYY-MM-DD) làm key unique gián tiếp
    // Tuy nhiên schema dùng DateTime @unique @db.Date, nên ta truyền startOfDay
    
    const report = await this.prisma.esgReport.upsert({
      where: { date: startOfDay },
      update: {
        idleTimeSaved: idleTimeSavedMin,
        co2Reduced: co2ReducedKg,
        peakAvoided: peakAvoided,
        details: { totalBookings, rescheduledCount, optimizedCount }
      },
      create: {
        date: startOfDay,
        idleTimeSaved: idleTimeSavedMin,
        co2Reduced: co2ReducedKg,
        peakAvoided: peakAvoided,
        details: { totalBookings, rescheduledCount, optimizedCount }
      }
    });

    return report;
  }

  // --- 2. Get Reports (Range) ---
  async getReports(from?: string, to?: string) {
    const whereClause: any = {};
    if (from) {
        whereClause.date = { gte: new Date(from) };
    }
    if (to) {
        whereClause.date = { ...whereClause.date, lte: new Date(to) };
    }

    return this.prisma.esgReport.findMany({
        where: whereClause,
        orderBy: { date: 'desc' }
    });
  }

  // --- 3. Export CSV ---
  async exportCsv() {
    const reports = await this.prisma.esgReport.findMany({
        orderBy: { date: 'desc' }
    });

    // Manual CSV generation
    const header = 'Date,Peak Congestion Avoided (Count),Idle Time Saved (Min),CO2 Reduced (Kg),Total Bookings processed\n';
    const rows = reports.map(r => {
        const details = r.details as any;
        const total = details?.totalBookings || 0;
        const dateStr = r.date.toISOString().split('T')[0];
        return `${dateStr},${r.peakAvoided},${r.idleTimeSaved},${r.co2Reduced},${total}`;
    }).join('\n');

    const csvContent = header + rows;
    
    return new StreamableFile(Buffer.from(csvContent));
  }
}
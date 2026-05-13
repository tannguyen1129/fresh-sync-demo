import { Injectable, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus, AssignmentType } from '@freshsync/shared';

type Assumptions = {
  dieselLitersPerHour: number;
  fuelPriceUsdPerLiter: number;
  co2KgPerLiter: number;
  idleMinutesPerPeakAvoided: number;
  earlyArrivalMinutesSaved: number;
  baselineTripsPerTruckWeek: number;
  catLaiBaselineTrucks: number;
  catLaiImpactPct: number;
  catLaiWaitReductionPct: number;
  catLaiAvgIdleHoursPerTruck: number;
  vndPerLiterDiesel: number;
};

type DailyMetric = {
  date: string;
  totalBookings: number;
  completedTrips: number;
  peakAvoided: number;
  earlyArrivalPrevented: number;
  idleTimeSaved: number;
  dieselSavedLiters: number;
  fuelCostSavedUsd: number;
  co2Reduced: number;
  fleetUtilization: number;
  gateCongestionReducedPct: number;
};

const DEFAULT_ASSUMPTIONS: Assumptions = {
  dieselLitersPerHour: 2.5,
  fuelPriceUsdPerLiter: 1.2,
  co2KgPerLiter: 2.68,
  idleMinutesPerPeakAvoided: 45,
  earlyArrivalMinutesSaved: 20,
  baselineTripsPerTruckWeek: 4.5,
  // Cat Lai green-economy scenario (per FreshSync solution doc)
  catLaiBaselineTrucks: 22000,
  catLaiImpactPct: 0.5,
  catLaiWaitReductionPct: 0.25,
  catLaiAvgIdleHoursPerTruck: 2.5,
  vndPerLiterDiesel: 22000,
};

@Injectable()
export class EsgService {
  constructor(private prisma: PrismaService) {}

  async generateDailyReport(dateString: string) {
    const { start, end } = this.resolveRange(dateString, dateString);
    const assumptions = await this.getAssumptions();
    const activeDrivers = await this.prisma.driver.count();
    const bookings = await this.loadBookings(start, end);
    const snapshot = this.buildSnapshot(bookings, assumptions, activeDrivers, start, end);

    if (snapshot.summary.totalBookings === 0) {
      return { message: 'No bookings found for this date.' };
    }

    const report = await this.prisma.esgReport.upsert({
      where: { date: start },
      update: {
        idleTimeSaved: snapshot.summary.idleTimeSaved,
        co2Reduced: snapshot.summary.co2Reduced,
        peakAvoided: snapshot.summary.peakAvoided,
        details: {
          ...snapshot.summary,
          assumptions,
        },
      },
      create: {
        date: start,
        idleTimeSaved: snapshot.summary.idleTimeSaved,
        co2Reduced: snapshot.summary.co2Reduced,
        peakAvoided: snapshot.summary.peakAvoided,
        details: {
          ...snapshot.summary,
          assumptions,
        },
      },
    });

    return report;
  }

  async getReports(from?: string, to?: string) {
    const { start, end } = this.resolveRange(from, to);
    return this.prisma.esgReport.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getBusinessRoiReport(companyId: string, from?: string, to?: string) {
    const { start, end } = this.resolveRange(from, to);
    const assumptions = await this.getAssumptions();
    const activeDrivers = await this.prisma.driver.count({ where: { companyId } });
    const bookings = await this.loadBookings(start, end, companyId);
    const snapshot = this.buildSnapshot(bookings, assumptions, activeDrivers, start, end);

    const driverBreakdown = this.buildDriverBreakdown(bookings);

    return {
      range: {
        from: start.toISOString(),
        to: end.toISOString(),
      },
      assumptions,
      summary: snapshot.summary,
      series: snapshot.series,
      driverBreakdown,
    };
  }

  async getCatLaiProjection() {
    const assumptions = await this.getAssumptions();
    const trucks = assumptions.catLaiBaselineTrucks;
    const impacted = Math.round(trucks * assumptions.catLaiImpactPct);
    const idleHoursPerTruck = assumptions.catLaiAvgIdleHoursPerTruck * assumptions.catLaiWaitReductionPct;
    const totalIdleHours = Math.round(impacted * idleHoursPerTruck);
    const dieselSavedLiters = Math.round(totalIdleHours * assumptions.dieselLitersPerHour);
    const co2KgPerDay = Math.round(dieselSavedLiters * assumptions.co2KgPerLiter);
    const co2TonsPerDay = Number((co2KgPerDay / 1000).toFixed(2));
    const co2TonsPerYear = Math.round(co2TonsPerDay * 365);
    const fuelCostSavedVnd = Math.round(dieselSavedLiters * assumptions.vndPerLiterDiesel);

    return {
      scenario: 'Cat Lai Expected Scenario',
      assumptions: {
        baselineTrucks: trucks,
        impactPct: assumptions.catLaiImpactPct,
        waitReductionPct: assumptions.catLaiWaitReductionPct,
        avgIdleHoursPerTruck: assumptions.catLaiAvgIdleHoursPerTruck,
        dieselLitersPerHour: assumptions.dieselLitersPerHour,
        co2KgPerLiter: assumptions.co2KgPerLiter,
        vndPerLiterDiesel: assumptions.vndPerLiterDiesel,
      },
      projection: {
        impactedTrucks: impacted,
        idleHoursSavedPerDay: totalIdleHours,
        dieselSavedLitersPerDay: dieselSavedLiters,
        co2KgPerDay,
        co2TonsPerDay,
        co2TonsPerYear,
        fuelCostSavedVndPerDay: fuelCostSavedVnd,
        fuelCostSavedVndPerYear: fuelCostSavedVnd * 365,
      },
      notes:
        'Mô phỏng theo Expected Scenario của FreshSync (Cảng Cát Lái 22.000 lượt xe/ngày, FreshSync tác động 50% chuyến, giảm 25% thời gian chờ).',
    };
  }

  async exportCsv() {
    const reports = await this.prisma.esgReport.findMany({
      orderBy: { date: 'desc' },
    });

    const header = [
      'Date',
      'Total Bookings',
      'Peak Avoided',
      'Early Arrival Prevented',
      'Idle Time Saved (Min)',
      'Diesel Saved (L)',
      'Fuel Cost Saved (USD)',
      'CO2 Reduced (Kg)',
    ].join(',');

    const rows = reports.map((report) => {
      const details = (report.details as Record<string, any> | null) ?? {};
      const dateStr = report.date.toISOString().split('T')[0];
      return [
        dateStr,
        details.totalBookings ?? 0,
        report.peakAvoided,
        details.earlyArrivalPrevented ?? 0,
        report.idleTimeSaved,
        details.dieselSavedLiters ?? 0,
        details.fuelCostSavedUsd ?? 0,
        report.co2Reduced,
      ].join(',');
    });

    return new StreamableFile(Buffer.from([header, ...rows].join('\n')));
  }

  private async loadBookings(start: Date, end: Date, companyId?: string) {
    return this.prisma.booking.findMany({
      where: {
        confirmedSlotStart: {
          gte: start,
          lte: end,
        },
        status: { not: BookingStatus.CANCELLED },
        ...(companyId ? { request: { companyId } } : {}),
      },
      include: {
        request: {
          include: {
            container: true,
            recommendation: true,
            company: true,
          },
        },
        assignments: {
          include: { driver: true },
        },
      },
      orderBy: { confirmedSlotStart: 'asc' },
    });
  }

  private async getAssumptions(): Promise<Assumptions> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'ESG_ASSUMPTIONS' },
    });

    return {
      ...DEFAULT_ASSUMPTIONS,
      ...((setting?.value as Record<string, number> | null) ?? {}),
    };
  }

  private buildSnapshot(bookings: any[], assumptions: Assumptions, activeDrivers: number, start: Date, end: Date) {
    const dayBuckets = new Map<string, any[]>();

    for (const booking of bookings) {
      const dateKey = booking.confirmedSlotStart.toISOString().slice(0, 10);
      const bucket = dayBuckets.get(dateKey) ?? [];
      bucket.push(booking);
      dayBuckets.set(dateKey, bucket);
    }

    const daysInRange = Math.max(1, Math.ceil((end.getTime() - start.getTime() + 1) / (1000 * 60 * 60 * 24)));
    const weeksInRange = Math.max(1, daysInRange / 7);
    const series: DailyMetric[] = Array.from(dayBuckets.entries()).map(([date, dayBookings]) =>
      this.computeDailyMetric(date, dayBookings, assumptions, activeDrivers, weeksInRange),
    );

    const summary = series.reduce(
      (acc, item) => ({
        totalBookings: acc.totalBookings + item.totalBookings,
        completedTrips: acc.completedTrips + item.completedTrips,
        peakAvoided: acc.peakAvoided + item.peakAvoided,
        earlyArrivalPrevented: acc.earlyArrivalPrevented + item.earlyArrivalPrevented,
        idleTimeSaved: acc.idleTimeSaved + item.idleTimeSaved,
        dieselSavedLiters: this.round2(acc.dieselSavedLiters + item.dieselSavedLiters),
        fuelCostSavedUsd: this.round2(acc.fuelCostSavedUsd + item.fuelCostSavedUsd),
        co2Reduced: this.round2(acc.co2Reduced + item.co2Reduced),
      }),
      {
        totalBookings: 0,
        completedTrips: 0,
        peakAvoided: 0,
        earlyArrivalPrevented: 0,
        idleTimeSaved: 0,
        dieselSavedLiters: 0,
        fuelCostSavedUsd: 0,
        co2Reduced: 0,
      },
    );

    const fleetUtilization = activeDrivers > 0
      ? this.round2(summary.completedTrips / activeDrivers / weeksInRange)
      : 0;
    const gateCongestionReducedPct = summary.totalBookings > 0
      ? this.round2((summary.peakAvoided / summary.totalBookings) * 100)
      : 0;

    return {
      summary: {
        ...summary,
        activeDrivers,
        fleetUtilization,
        gateCongestionReducedPct,
      },
      series,
    };
  }

  private computeDailyMetric(date: string, bookings: any[], assumptions: Assumptions, activeDrivers: number, weeksInRange: number): DailyMetric {
    const totalBookings = bookings.length;
    const rescheduledCount = bookings.filter((booking) => booking.status === BookingStatus.RESCHEDULED).length;
    const actionableBookings = bookings.filter((booking) => booking.status !== BookingStatus.BLOCKED);
    const earlyArrivalPrevented = actionableBookings.filter((booking) => {
      const suggestion =
        booking.assignments?.[0]?.routeJson?.suggestedArrivalTime ??
        booking.request.recommendation?.routeJson?.suggestedArrivalTime;
      return Boolean(suggestion);
    }).length;
    const peakAvoided = rescheduledCount + Math.max(0, Math.round(actionableBookings.length * 0.2));
    const idleTimeSaved =
      (peakAvoided * assumptions.idleMinutesPerPeakAvoided) +
      (earlyArrivalPrevented * assumptions.earlyArrivalMinutesSaved);
    const completedTrips = bookings.filter((booking) =>
      booking.assignments?.some((assignment: any) =>
        assignment.type === AssignmentType.PICKUP && assignment.status === 'DELIVERED',
      ),
    ).length;
    const idleHours = idleTimeSaved / 60;
    const dieselSavedLiters = this.round2(idleHours * assumptions.dieselLitersPerHour);
    const fuelCostSavedUsd = this.round2(dieselSavedLiters * assumptions.fuelPriceUsdPerLiter);
    const co2Reduced = this.round2(dieselSavedLiters * assumptions.co2KgPerLiter);
    const fleetUtilization = activeDrivers > 0
      ? this.round2(completedTrips / activeDrivers / weeksInRange)
      : 0;
    const gateCongestionReducedPct = totalBookings > 0
      ? this.round2((peakAvoided / totalBookings) * 100)
      : 0;

    return {
      date,
      totalBookings,
      completedTrips,
      peakAvoided,
      earlyArrivalPrevented,
      idleTimeSaved,
      dieselSavedLiters,
      fuelCostSavedUsd,
      co2Reduced,
      fleetUtilization,
      gateCongestionReducedPct,
    };
  }

  private buildDriverBreakdown(bookings: any[]) {
    const driverMap = new Map<string, { driverName: string; completedTrips: number; containersHandled: string[] }>();

    for (const booking of bookings) {
      for (const assignment of booking.assignments ?? []) {
        if (assignment.type !== AssignmentType.PICKUP || assignment.status !== 'DELIVERED') continue;
        const key = assignment.driverId;
        const existing = driverMap.get(key) ?? {
          driverName: assignment.driver?.name ?? 'Unknown Driver',
          completedTrips: 0,
          containersHandled: [],
        };
        existing.completedTrips += 1;
        existing.containersHandled.push(booking.request.container.containerNo);
        driverMap.set(key, existing);
      }
    }

    return Array.from(driverMap.values())
      .map((item) => ({
        ...item,
        containersHandled: item.containersHandled.join(', '),
      }))
      .sort((a, b) => b.completedTrips - a.completedTrips);
  }

  private resolveRange(from?: string, to?: string) {
    const start = from ? new Date(from) : new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }
}

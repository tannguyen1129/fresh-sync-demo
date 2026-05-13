import { PrismaClient, Role, CompanyType, DOStatus, DriverStatus, ContainerStatus, RequestStatus, BookingStatus, AssignmentStatus, AssignmentType, CargoType, CustomsStatus, ContainerAvailability } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function gateUtilizationByHour(hour: number) {
  if (hour >= 14 && hour <= 17) return hour === 16 ? 100 : 95;
  if (hour >= 12 && hour <= 13) return 68;
  if (hour >= 9 && hour <= 11) return 54;
  if (hour >= 18 && hour <= 20) return 46;
  if (hour >= 6 && hour <= 8) return 32;
  return 18;
}

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Clean up
  await prisma.assignment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.pickupRequest.deleteMany();
  await prisma.emptyReturnInstruction.deleteMany();
  await prisma.deliveryOrder.deleteMany();
  await prisma.container.deleteMany();
  await prisma.vessel.deleteMany();
  await prisma.gateCapacity.deleteMany();
  await prisma.yardStatus.deleteMany();
  await prisma.craneStatus.deleteMany();
  await prisma.yardEquipment.deleteMany();
  await prisma.depot.deleteMany();
  await prisma.disruption.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.esgReport.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // 2. Create Companies
  const operator = await prisma.company.create({
    data: { name: 'FreshPort Operator', type: CompanyType.PORT_OPERATOR },
  });
  
  const authority = await prisma.company.create({
    data: { name: 'Port Authority', type: CompanyType.AUTHORITY },
  });

  const shippingLine = await prisma.company.create({
    data: { name: 'Ocean Network Express', type: CompanyType.SHIPPING_LINE },
  });

  const logistics1 = await prisma.company.create({ data: { name: 'FastLogistics Co', type: CompanyType.LOGISTICS } });
  const logistics2 = await prisma.company.create({ data: { name: 'GreenHaul', type: CompanyType.LOGISTICS } });
  const logistics3 = await prisma.company.create({ data: { name: 'SpeedyTrans', type: CompanyType.LOGISTICS } });

  // Helper hash (Fix: rename variable to avoid conflict with function name)
  const hashedPassword = await bcrypt.hash('123456', 10);

  console.log('👤 Creating Users with password "123456"');

  // 3. Create Users
  await prisma.user.create({
    data: { 
        email: 'ops@port.com', 
        name: 'Port Operator', 
        passwordHash: hashedPassword, 
        role: Role.PORT_OPERATOR, 
        companyId: operator.id 
    },
  });
  
  await prisma.user.create({
    data: { 
        email: 'biz@logistics.com', 
        name: 'Logistics Coordinator', 
        passwordHash: hashedPassword, 
        role: Role.LOGISTICS_COORDINATOR, 
        companyId: logistics1.id 
    },
  });

  await prisma.user.create({
    data: { 
        email: 'admin@authority.gov', 
        name: 'Authority Officer', 
        passwordHash: hashedPassword, 
        role: Role.PORT_AUTHORITY, 
        companyId: authority.id 
    },
  });

  // 4. Create Drivers (10 drivers)
  const driversData = [
    { name: 'Nguyen Van A', phone: '0901234567', plate: '51C-123.45', companyId: logistics1.id },
    { name: 'Tran Van B', phone: '0901234568', plate: '51C-567.89', companyId: logistics1.id },
    { name: 'Le Van C', phone: '0901234569', plate: '29H-999.99', companyId: logistics2.id },
    { name: 'Pham Van D', phone: '0901234570', plate: '51D-111.11', companyId: logistics2.id },
    { name: 'Hoang Van E', phone: '0901234571', plate: '51D-222.22', companyId: logistics3.id },
    { name: 'Vu Van F', phone: '0901234572', plate: '60C-333.33', companyId: logistics1.id },
    { name: 'Dang Van G', phone: '0901234573', plate: '60C-444.44', companyId: logistics2.id },
    { name: 'Bui Van H', phone: '0901234574', plate: '61C-555.55', companyId: logistics3.id },
    { name: 'Do Van I', phone: '0901234575', plate: '61C-666.66', companyId: logistics1.id },
    { name: 'Ly Van K', phone: '0901234576', plate: '62C-777.77', companyId: logistics2.id },
  ];
  
  let primaryDriverCreated = false;

  for (const d of driversData) {
    const driver = await prisma.driver.create({
      data: { 
        name: d.name,
        phone: d.phone,
        companyId: d.companyId,
        licensePlate: d.plate,
        status: DriverStatus.IDLE
      }
    });

    if (!primaryDriverCreated) {
      await prisma.user.create({
        data: {
          email: 'driver@fleet.com',
          name: d.name,
          passwordHash: hashedPassword,
          role: Role.TRUCK_DRIVER,
          companyId: d.companyId,
          driverId: driver.id
        }
      });
      primaryDriverCreated = true;
      continue;
    }

    await prisma.user.create({
      data: {
        email: `driver${d.phone.slice(-4)}@app.com`,
        name: d.name,
        passwordHash: hashedPassword,
        role: Role.TRUCK_DRIVER,
        companyId: d.companyId,
        driverId: driver.id
      }
    });
  }

  await prisma.user.create({
    data: {
      email: 'system@one-line.com',
      name: 'ONE Line System',
      passwordHash: hashedPassword,
      role: Role.SHIPPING_LINE_SYSTEM,
      companyId: shippingLine.id
    }
  });

  await prisma.user.create({
    data: {
      email: 'tos@terminal.local',
      name: 'Terminal Operating System',
      passwordHash: hashedPassword,
      role: Role.TOS_SYSTEM,
      companyId: operator.id
    }
  });

  await prisma.systemSetting.create({
    data: {
      key: 'ESG_ASSUMPTIONS',
      value: {
        dieselLitersPerHour: 2.5,
        fuelPriceUsdPerLiter: 1.2,
        co2KgPerLiter: 2.68,
        idleMinutesPerPeakAvoided: 45,
        earlyArrivalMinutesSaved: 20,
        baselineTripsPerTruckWeek: 4.5,
        // Cat Lai expected scenario (SRS Green Economy)
        catLaiBaselineTrucks: 22000,
        catLaiImpactPct: 0.5,
        catLaiWaitReductionPct: 0.25,
        catLaiAvgIdleHoursPerTruck: 2.5,
        vndPerLiterDiesel: 22000,
      },
      updatedBy: 'seed',
    },
  });

  await prisma.systemSetting.create({
    data: {
      key: 'PRIORITY_RULES',
      value: {
        cargoSoftQuota: { DRY: 0.65, REEFER: 0.22, OOG: 0.08, BUFFER: 0.05 },
        cargoUrgencyWeight: { DRY: 1.0, REEFER: 3.0, OOG: 2.5 },
        priorityFlagBonus: 1.5,
      },
      updatedBy: 'seed',
    },
  });

  await prisma.yardEquipment.createMany({
    data: [
      { equipmentId: 'RS-01', type: 'REACH_STACKER', zoneId: 'ZONE_A', status: 'AVAILABLE' },
      { equipmentId: 'RS-02', type: 'REACH_STACKER', zoneId: 'ZONE_B', status: 'BUSY' },
      { equipmentId: 'RTG-01', type: 'RTG', zoneId: 'ZONE_A', status: 'AVAILABLE' },
      { equipmentId: 'RTG-02', type: 'RTG', zoneId: 'ZONE_B', status: 'AVAILABLE' },
      { equipmentId: 'REF-PWR-01', type: 'REEFER_POWER', zoneId: 'ZONE_REEFER', status: 'AVAILABLE' },
      { equipmentId: 'REF-PWR-02', type: 'REEFER_POWER', zoneId: 'ZONE_REEFER', status: 'BUSY' },
      { equipmentId: 'OOG-01', type: 'OOG_HANDLER', zoneId: 'ZONE_C', status: 'AVAILABLE' },
    ],
  });

  // 5. Create Infrastructure (Depots, Yard, Cranes)
  await prisma.depot.createMany({
    data: [
      { name: 'Depot A (Tan Thuan)', lat: 10.762622, lng: 106.660172, capacity: 500, currentLoad: 120, status: 'OPEN' },
      { name: 'Depot B (Cat Lai)', lat: 10.770000, lng: 106.700000, capacity: 1000, currentLoad: 800, status: 'OPEN' }, // High load
      { name: 'Depot C (Hiep Phuoc)', lat: 10.650000, lng: 106.750000, capacity: 600, currentLoad: 50, status: 'OPEN' },
      { name: 'Depot D (ICD Thu Duc)', lat: 10.850000, lng: 106.780000, capacity: 400, currentLoad: 390, status: 'FULL' },
      { name: 'Depot E (Phu Huu)', lat: 10.780000, lng: 106.800000, capacity: 500, currentLoad: 200, status: 'OPEN' },
    ]
  });

  await prisma.yardStatus.createMany({
    data: [
      { zoneId: 'ZONE_A', occupancyPct: 45.5 },
      { zoneId: 'ZONE_B', occupancyPct: 88.0 }, // Congested
      { zoneId: 'ZONE_C', occupancyPct: 12.0 },
      { zoneId: 'ZONE_REEFER', occupancyPct: 60.0 },
    ]
  });

  await prisma.craneStatus.createMany({
    data: [
      { craneId: 'QC-01', isOperational: true },
      { craneId: 'QC-02', isOperational: true },
      { craneId: 'QC-03', isOperational: false, maintenanceNote: 'Hydraulic leak' },
      { craneId: 'RTG-01', isOperational: true },
    ]
  });

  // 6. Gate Capacity (7 days)
  const now = new Date();
  now.setMinutes(0, 0, 0);
  
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const start = new Date(now);
      start.setDate(start.getDate() + d);
      start.setHours(h);
      const end = new Date(start);
      end.setHours(h + 1);

      // Simulate Peak Hours (14:00 - 17:00)
      const isPeak = h >= 14 && h <= 17;
      
      await prisma.gateCapacity.create({
        data: {
          startTime: start,
          endTime: end,
          maxSlots: 100,
          usedSlots: gateUtilizationByHour(h),
          isPeakHour: isPeak,
          status: 'OPEN'
        }
      });
    }
  }

  // 7. Vessels & Containers
  const vessel = await prisma.vessel.create({
    data: {
      vesselCode: 'VSL-001',
      vesselName: 'Ever Given',
      eta: new Date(new Date().getTime() - 24 * 60 * 60 * 1000), // Arrived yesterday
      etd: new Date(new Date().getTime() + 48 * 60 * 60 * 1000),
      status: 'ARRIVED'
    }
  });

  const scenarioMap: Record<number, {
    status: ContainerStatus;
    doStatus: DOStatus;
    customsStatus?: CustomsStatus;
    yardZone: string;
    crtOffsetHours: number;
    cargoType?: CargoType;
    isReefer?: boolean;
    isOog?: boolean;
    availability?: ContainerAvailability;
    allowedDepots?: string[];
    notes?: string;
  }> = {
    1: {
      status: ContainerStatus.DISCHARGED,
      doStatus: DOStatus.RELEASED,
      customsStatus: CustomsStatus.CLEARED,
      yardZone: 'ZONE_A',
      crtOffsetHours: 1,
      cargoType: CargoType.DRY,
      availability: ContainerAvailability.READY,
      allowedDepots: ['Depot A (Tan Thuan)', 'Depot B (Cat Lai)', 'Depot D (ICD Thu Duc)'],
      notes: 'Green path demo container (DRY, customs cleared)',
    },
    5: {
      status: ContainerStatus.DISCHARGED,
      doStatus: DOStatus.RELEASED,
      customsStatus: CustomsStatus.CLEARED,
      yardZone: 'ZONE_REEFER',
      crtOffsetHours: 5,
      isReefer: true,
      cargoType: CargoType.REEFER,
      availability: ContainerAvailability.READY,
      allowedDepots: ['Depot A (Tan Thuan)', 'Depot B (Cat Lai)'],
      notes: 'Reefer priority scenario',
    },
    7: {
      status: ContainerStatus.DISCHARGED,
      doStatus: DOStatus.RELEASED,
      customsStatus: CustomsStatus.PENDING,
      yardZone: 'ZONE_A',
      crtOffsetHours: 3,
      cargoType: CargoType.DRY,
      availability: ContainerAvailability.READY,
      allowedDepots: ['Depot A (Tan Thuan)', 'Depot B (Cat Lai)'],
      notes: 'Customs PENDING — waiting flow',
    },
    8: {
      status: ContainerStatus.DISCHARGED,
      doStatus: DOStatus.RELEASED,
      customsStatus: CustomsStatus.INSPECTION_REQUIRED,
      yardZone: 'ZONE_C',
      crtOffsetHours: 6,
      cargoType: CargoType.DRY,
      availability: ContainerAvailability.UNDER_OPERATION,
      allowedDepots: ['Depot C (Hiep Phuoc)', 'Depot A (Tan Thuan)'],
      notes: 'Inspection required scenario',
    },
    10: {
      status: ContainerStatus.DISCHARGED,
      doStatus: DOStatus.EXPIRED,
      customsStatus: CustomsStatus.CLEARED,
      yardZone: 'ZONE_A',
      crtOffsetHours: 2,
      cargoType: CargoType.DRY,
      availability: ContainerAvailability.READY,
      allowedDepots: ['Depot A (Tan Thuan)'],
      notes: 'D/O EXPIRED scenario',
    },
    11: {
      status: ContainerStatus.DISCHARGED,
      doStatus: DOStatus.RELEASED,
      customsStatus: CustomsStatus.CLEARED,
      yardZone: 'ZONE_C',
      crtOffsetHours: 8,
      cargoType: CargoType.OOG,
      isOog: true,
      availability: ContainerAvailability.READY,
      allowedDepots: ['Depot C (Hiep Phuoc)'],
      notes: 'OOG cargo scenario',
    },
    13: {
      status: ContainerStatus.DISCHARGED,
      doStatus: DOStatus.HOLD,
      customsStatus: CustomsStatus.CLEARED,
      yardZone: 'ZONE_B',
      crtOffsetHours: 2,
      cargoType: CargoType.DRY,
      availability: ContainerAvailability.READY,
      allowedDepots: ['Depot A (Tan Thuan)', 'Depot B (Cat Lai)'],
      notes: 'Commercial HOLD red scenario',
    },
    14: {
      status: ContainerStatus.INCOMING,
      doStatus: DOStatus.RELEASED,
      customsStatus: CustomsStatus.PENDING,
      yardZone: 'ZONE_C',
      crtOffsetHours: 18,
      cargoType: CargoType.DRY,
      availability: ContainerAvailability.NOT_READY,
      allowedDepots: ['Depot B (Cat Lai)', 'Depot C (Hiep Phuoc)'],
      notes: 'Container not ready scenario',
    },
    16: {
      status: ContainerStatus.DISCHARGED,
      doStatus: DOStatus.RELEASED,
      customsStatus: CustomsStatus.HOLD,
      yardZone: 'ZONE_B',
      crtOffsetHours: 1,
      cargoType: CargoType.DRY,
      availability: ContainerAvailability.BLOCKED,
      allowedDepots: ['Depot A (Tan Thuan)'],
      notes: 'Customs HOLD scenario',
    },
  };

  // Create 20 Containers
  for (let i = 1; i <= 20; i++) {
    const containerNo = `CONT-${String(i).padStart(3, '0')}`;
    const scenario = scenarioMap[i];
    const defaultZone = i % 2 === 0 ? 'ZONE_A' : 'ZONE_B';
    const isReefer = scenario?.isReefer ?? i % 5 === 0;
    const isOog = scenario?.isOog ?? false;
    const cargoType = scenario?.cargoType ?? (isOog ? CargoType.OOG : isReefer ? CargoType.REEFER : CargoType.DRY);
    const containerStatus = scenario?.status ?? ContainerStatus.DISCHARGED;
    const yardZone = scenario?.yardZone ?? (isReefer ? 'ZONE_REEFER' : defaultZone);
    const crtOffsetHours = scenario?.crtOffsetHours ?? (containerStatus === ContainerStatus.INCOMING ? 16 : (i % 6) + 2);
    const sizeType = scenario?.isOog ? '40HC' : i % 3 === 0 ? '40HC' : '20DC';
    const availability = scenario?.availability ?? (containerStatus === ContainerStatus.INCOMING ? ContainerAvailability.NOT_READY : ContainerAvailability.READY);

    const container = await prisma.container.create({
      data: {
        containerNo,
        sizeType,
        isReefer,
        isOog,
        cargoType,
        vesselId: vessel.id,
        status: containerStatus,
        yardZone,
        yardBlock: `${yardZone}-${String((i % 9) + 1).padStart(2, '0')}`,
        availability,
        crt: addHours(now, crtOffsetHours),
      },
    });

    const doValidUntil =
      scenario?.doStatus === DOStatus.EXPIRED ? addHours(now, -6) : addHours(now, 7 * 24);

    await prisma.deliveryOrder.create({
      data: {
        containerId: container.id,
        status: scenario?.doStatus ?? DOStatus.RELEASED,
        customsStatus: scenario?.customsStatus ?? CustomsStatus.CLEARED,
        validUntil: doValidUntil,
      },
    });

    await prisma.emptyReturnInstruction.create({
      data: {
        containerId: container.id,
        shippingLine: 'ONE',
        allowedDepots: scenario?.allowedDepots ?? ['Depot A (Tan Thuan)', 'Depot B (Cat Lai)'],
        notes: scenario?.notes ?? 'Clean before return',
      },
    });
  }

  const roiContainers = await prisma.container.findMany({
    where: {
      containerNo: { in: ['CONT-002', 'CONT-003', 'CONT-004'] },
    },
    include: {
      deliveryOrder: true,
    },
    orderBy: { containerNo: 'asc' },
  });

  const roiDrivers = await prisma.driver.findMany({
    where: { companyId: logistics1.id },
    orderBy: { name: 'asc' },
    take: 3,
  });

  const roiScenarios = [
    { containerNo: 'CONT-002', dayOffset: -3, status: BookingStatus.COMPLETED, driver: roiDrivers[0], riskScore: 11.8, explanation: 'Historical completed low-risk slot.' },
    { containerNo: 'CONT-003', dayOffset: -2, status: BookingStatus.RESCHEDULED, driver: roiDrivers[1] ?? roiDrivers[0], riskScore: 24.5, explanation: 'Historical rescheduled slot after gate rebalancing.' },
    { containerNo: 'CONT-004', dayOffset: -1, status: BookingStatus.COMPLETED, driver: roiDrivers[2] ?? roiDrivers[0], riskScore: 16.2, explanation: 'Historical completed slot with JIT timing.' },
  ];

  for (const scenario of roiScenarios) {
    const container = roiContainers.find((item) => item.containerNo === scenario.containerNo);
    if (!container || !scenario.driver) continue;

    const slotStart = addHours(addDays(now, scenario.dayOffset), 9);
    const slotEnd = addHours(slotStart, 1);

    const request = await prisma.pickupRequest.create({
      data: {
        companyId: logistics1.id,
        containerId: container.id,
        requestedTime: addHours(slotStart, -2),
        priority: scenario.containerNo === 'CONT-003',
        cargoType: container.isReefer ? 'REEFER_FOOD' : 'GENERAL_CARGO',
        truckPlate: scenario.driver.licensePlate,
        driverName: scenario.driver.name,
        driverPhone: scenario.driver.phone,
        terminalCode: container.yardZone === 'ZONE_B' ? 'TML-B' : 'TML-A',
        status: RequestStatus.CONFIRMED,
      },
    });

    await prisma.recommendation.create({
      data: {
        requestId: request.id,
        slotStart,
        slotEnd,
        riskScore: scenario.riskScore,
        explanation: scenario.explanation,
        assignedGate: container.yardZone === 'ZONE_B' ? 'GATE_2' : 'GATE_1',
        predictedWaitMin: container.yardZone === 'ZONE_B' ? 24 : 14,
        validationTrace: {
          gateCapacity: container.yardZone === 'ZONE_B' ? 'Peak Risk' : 'Gate Available',
          yardZone: container.yardZone,
          disruptionCount: scenario.status === BookingStatus.RESCHEDULED ? 1 : 0,
          utilizationPct: container.yardZone === 'ZONE_B' ? 88 : 52,
        },
        riskFactors: [
          {
            factor: container.yardZone === 'ZONE_B' ? 'yard_overload' : 'gate_utilization',
            impact: container.yardZone === 'ZONE_B' ? 20 : 12,
            description: container.yardZone === 'ZONE_B' ? 'Zone B is under pressure' : 'Healthy gate load',
          },
        ],
        routeJson: {
          gate: container.yardZone === 'ZONE_B' ? 'GATE_2' : 'GATE_1',
          yardZone: container.yardZone,
          exitGate: container.yardZone === 'ZONE_B' ? 'EXIT_SOUTH' : 'EXIT_MAIN',
          etaToGateMinutes: container.yardZone === 'ZONE_B' ? 18 : 12,
          distanceKm: container.yardZone === 'ZONE_B' ? 14.8 : 10.4,
          suggestedArrivalTime: addHours(slotStart, -0.25).toISOString(),
          steps: ['Driver staging lane', container.yardZone === 'ZONE_B' ? 'GATE_2' : 'GATE_1', container.yardZone, 'EXIT_MAIN'],
        },
      },
    });

    const booking = await prisma.booking.create({
      data: {
        requestId: request.id,
        bookingCode: `FS-HIST-${scenario.containerNo.slice(-3)}`,
        confirmedSlotStart: slotStart,
        confirmedSlotEnd: slotEnd,
        terminalCode: container.yardZone === 'ZONE_B' ? 'TML-B' : 'TML-A',
        assignedGate: container.yardZone === 'ZONE_B' ? 'GATE_2' : 'GATE_1',
        qrToken: `FSQR-HIST-${scenario.containerNo.slice(-3)}`,
        checkInStatus: scenario.status === BookingStatus.RESCHEDULED ? 'RESCHEDULED' : 'CHECKED_IN',
        checkInAt: scenario.status === BookingStatus.RESCHEDULED ? null : addHours(slotStart, -0.05),
        status: scenario.status,
        blockedReason: scenario.status === BookingStatus.RESCHEDULED ? 'Rescheduled due to GATE_CONGESTION' : null,
      },
    });

    await prisma.assignment.create({
      data: {
        bookingId: booking.id,
        driverId: scenario.driver.id,
        type: AssignmentType.PICKUP,
        status: AssignmentStatus.DELIVERED,
        etaToGate: addHours(slotStart, -0.2),
        actualIn: addHours(slotStart, 0.1),
        actualOut: addHours(slotStart, 0.3),
        routeJson: {
          gate: container.yardZone === 'ZONE_B' ? 'GATE_2' : 'GATE_1',
          yardZone: container.yardZone,
          exitGate: container.yardZone === 'ZONE_B' ? 'EXIT_SOUTH' : 'EXIT_MAIN',
          distanceKm: container.yardZone === 'ZONE_B' ? 14.8 : 10.4,
          etaToGateMinutes: container.yardZone === 'ZONE_B' ? 18 : 12,
          suggestedArrivalTime: addHours(slotStart, -0.25).toISOString(),
          steps: ['Driver staging lane', container.yardZone === 'ZONE_B' ? 'GATE_2' : 'GATE_1', container.yardZone, 'EXIT_MAIN'],
        },
      },
    });
  }

  const seededReports = [
    { dayOffset: -3, totalBookings: 2, peakAvoided: 1, earlyArrivalPrevented: 2, completedTrips: 1 },
    { dayOffset: -2, totalBookings: 3, peakAvoided: 2, earlyArrivalPrevented: 2, completedTrips: 1 },
    { dayOffset: -1, totalBookings: 2, peakAvoided: 1, earlyArrivalPrevented: 1, completedTrips: 1 },
  ];

  for (const seededReport of seededReports) {
    const date = addDays(now, seededReport.dayOffset);
    date.setHours(0, 0, 0, 0);
    const idleTimeSaved = (seededReport.peakAvoided * 45) + (seededReport.earlyArrivalPrevented * 20);
    const dieselSavedLiters = Number(((idleTimeSaved / 60) * 2.5).toFixed(2));
    const fuelCostSavedUsd = Number((dieselSavedLiters * 1.2).toFixed(2));
    const co2Reduced = Number((dieselSavedLiters * 2.68).toFixed(2));

    await prisma.esgReport.create({
      data: {
        date,
        idleTimeSaved,
        peakAvoided: seededReport.peakAvoided,
        co2Reduced,
        details: {
          totalBookings: seededReport.totalBookings,
          completedTrips: seededReport.completedTrips,
          earlyArrivalPrevented: seededReport.earlyArrivalPrevented,
          dieselSavedLiters,
          fuelCostSavedUsd,
          assumptions: {
            dieselLitersPerHour: 2.5,
            fuelPriceUsdPerLiter: 1.2,
            co2KgPerLiter: 2.68,
            idleMinutesPerPeakAvoided: 45,
            earlyArrivalMinutesSaved: 20,
            baselineTripsPerTruckWeek: 4.5,
          },
        },
      },
    });
  }

  console.log('✅ Seed completed successfully!');
  console.log('   - Demo accounts: ops@port.com, biz@logistics.com, driver@fleet.com, admin@authority.gov, system@one-line.com, tos@terminal.local');
  console.log('   - 5 depots, 1 vessel, 20 deterministic containers');
  console.log('   - CONT-001 green path, CONT-013 HOLD, CONT-014 not ready');
  console.log('   - ROI seed: historical bookings for CONT-002/003/004 and 3 ESG reports');
  console.log('   - 7 days of deterministic gate capacity generated');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient, Role, CompanyType, DOStatus, DriverStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
  await prisma.depot.deleteMany();
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

    // Create Driver User Account
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
          usedSlots: isPeak ? 95 : Math.floor(Math.random() * 50), // Peak gần full
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

  // Create 20 Containers
  for (let i = 1; i <= 20; i++) {
    const isHold = i === 13; // Lucky number 13 is HOLD
    const containerNo = `CONT-${String(i).padStart(3, '0')}`; // CONT-001, CONT-013...

    const container = await prisma.container.create({
      data: {
        containerNo: containerNo,
        sizeType: i % 3 === 0 ? '40HC' : '20DC',
        isReefer: i % 5 === 0,
        vesselId: vessel.id,
        status: 'DISCHARGED',
        yardZone: i % 5 === 0 ? 'ZONE_REEFER' : (i % 2 === 0 ? 'ZONE_A' : 'ZONE_B'),
        crt: new Date(new Date().getTime() + (Math.random() * 24 * 60 * 60 * 1000)), // CRT random next 24h
      }
    });

    // Create D/O
    await prisma.deliveryOrder.create({
      data: {
        containerId: container.id,
        status: isHold ? DOStatus.HOLD : DOStatus.RELEASED,
        validUntil: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
      }
    });

    // Create Empty Return Instruction
    await prisma.emptyReturnInstruction.create({
      data: {
        containerId: container.id,
        shippingLine: 'ONE',
        allowedDepots: ['Depot A (Tan Thuan)', 'Depot B (Cat Lai)'],
        notes: 'Clean before return'
      }
    });
  }

  console.log('✅ Seed completed successfully!');
  console.log('   - 1 Port Operator, 3 Logistics Co, 10 Drivers');
  console.log('   - 5 Depots, 1 Vessel, 20 Containers');
  console.log('   - CONT-013 is set to HOLD (Demo UC2)');
  console.log('   - 7 days of Gate Capacity generated');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
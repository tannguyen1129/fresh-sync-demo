import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RequestStatus,
  BookingStatus,
  EVENTS,
  BookingUpdatedPayload,
  NotificationPayload,
} from '@freshsync/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventsGateway } from '../gateway/events.gateway';
import { CargoType } from '@prisma/client';
import {
  CARGO_SOFT_QUOTA,
  computePriorityScore,
  resolveCargoType,
  validateGate,
} from './triple-validation';

@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('orchestration') private orchestrationQueue: Queue,
    private events: EventsGateway,
  ) {}

  // --- 1. Core Logic: Generate Recommendation ---

  async generateRecommendation(requestId: string) {
    const request = await this.prisma.pickupRequest.findUnique({
      where: { id: requestId },
      include: { container: { include: { vessel: true } } },
    });

    if (!request) throw new NotFoundException('Request not found');

    const crt = await this.predictCRT(request.container);

    await this.prisma.container.update({
      where: { id: request.containerId },
      data: { crt },
    });

    const cargoType = resolveCargoType({
      isReefer: request.container.isReefer,
      isOog: request.container.isOog,
      cargoType: request.container.cargoType,
      hintFromRequest: request.cargoType,
    });

    // Priority score helps the engine pick the better slot when several are eligible.
    const waitingMinutes = (Date.now() - request.createdAt.getTime()) / (1000 * 60);
    const deadlineMinutes = request.requestedTime
      ? Math.max(0, (request.requestedTime.getTime() - Date.now()) / (1000 * 60))
      : null;
    const backlog = await this.getCargoBacklog(cargoType);
    const priorityScoreData = computePriorityScore({
      cargoType,
      waitingMinutes,
      deadlineMinutes,
      resourceConstraint: cargoType === CargoType.OOG ? 0.8 : cargoType === CargoType.REEFER ? 0.6 : 0.3,
      backlogPressure: backlog,
      isPriorityFlag: request.priority,
    });

    await this.prisma.pickupRequest.update({
      where: { id: request.id },
      data: {
        resolvedCargoType: cargoType,
        priorityScore: priorityScoreData.score,
      },
    });

    const slots = await this.findCapacityAwareSlots({
      crt,
      container: request.container,
      cargoType,
      isPriority: request.priority,
      priorityScore: priorityScoreData.score,
      requestedTime: request.requestedTime,
    });

    if (slots.length === 0) {
      this.logger.warn(`No slots available for Request ${requestId}`);
      return null;
    }

    const bestSlot = slots.sort((a, b) => a.riskScore - b.riskScore)[0];

    const recommendation = await this.prisma.recommendation.upsert({
      where: { requestId: request.id },
      create: {
        requestId: request.id,
        slotStart: bestSlot.start,
        slotEnd: bestSlot.end,
        routeJson: bestSlot.routeJson,
        riskScore: bestSlot.riskScore,
        explanation: bestSlot.explanation,
        assignedGate: bestSlot.assignedGate,
        predictedWaitMin: bestSlot.predictedWaitMin,
        validationTrace: bestSlot.validationTrace,
        riskFactors: bestSlot.riskFactors,
      },
      update: {
        slotStart: bestSlot.start,
        slotEnd: bestSlot.end,
        routeJson: bestSlot.routeJson,
        riskScore: bestSlot.riskScore,
        explanation: bestSlot.explanation,
        assignedGate: bestSlot.assignedGate,
        predictedWaitMin: bestSlot.predictedWaitMin,
        validationTrace: bestSlot.validationTrace,
        riskFactors: bestSlot.riskFactors,
      },
    });

    await this.prisma.pickupRequest.update({
      where: { id: request.id },
      data: { status: RequestStatus.RECOMMENDED },
    });

    return {
      recommendation,
      cargoType,
      priorityScore: priorityScoreData,
      diagnostics: {
        crt,
        gateCapacity: bestSlot.gateCapacity,
        routeJson: bestSlot.routeJson,
      },
    };
  }

  // --- 2. Algorithms (Demo Rules) ---

  private async predictCRT(container: any): Promise<Date> {
    if (container.crt) {
      return new Date(container.crt);
    }

    const eta = new Date(container.vessel.eta);
    const dischargeHours = 4;
    const yardShuffleHours = container.yardZone === 'ZONE_B' ? 5 : container.yardZone === 'ZONE_REEFER' ? 6 : 2;
    const reeferFactor = container.isReefer ? 2 : 0;
    const oogFactor = container.isOog ? 3 : 0;
    const statusFactor = container.status === 'INCOMING' ? 12 : 0;

    const totalDelay = dischargeHours + yardShuffleHours + reeferFactor + oogFactor + statusFactor;
    return new Date(eta.getTime() + totalDelay * 60 * 60 * 1000);
  }

  private async getCargoBacklog(cargoType: CargoType): Promise<number> {
    const pending = await this.prisma.pickupRequest.count({
      where: {
        resolvedCargoType: cargoType,
        status: { in: [RequestStatus.CREATED, RequestStatus.VALIDATING, RequestStatus.RECOMMENDED] },
      },
    });
    // Normalize to 0..1, saturate at 10 pending requests
    return Math.min(pending / 10, 1);
  }

  private async findCapacityAwareSlots({
    crt,
    container,
    cargoType,
    isPriority,
    priorityScore,
    requestedTime,
    limit = 12,
  }: {
    crt: Date;
    container: any;
    cargoType: CargoType;
    isPriority: boolean;
    priorityScore: number;
    requestedTime?: Date | null;
    limit?: number;
  }) {
    const endWindow = new Date(crt.getTime() + 48 * 60 * 60 * 1000);
    const yardZone = container.yardZone ?? 'ZONE_A';
    const yardStatus = await this.prisma.yardStatus.findUnique({
      where: { zoneId: yardZone },
    });
    const activeDisruptions = await this.prisma.disruption.findMany({
      where: {
        isActive: true,
        affectedZones: {
          has: yardZone,
        },
      },
    });

    const capacities = await this.prisma.gateCapacity.findMany({
      where: {
        startTime: { gte: crt, lte: endWindow },
        status: { in: ['OPEN', 'RESTRICTED'] },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });

    return capacities
      .map((cap) => {
        const utilization = cap.usedSlots / Math.max(cap.maxSlots, 1);
        const yardOccupancyPct = yardStatus?.occupancyPct ?? 50;
        const disruptionPenalty = activeDisruptions.length > 0 ? 30 : 0;
        const reasons: string[] = [];
        const riskFactors: { factor: string; impact: number; description: string }[] = [];
        let riskScore = 0;

        riskScore += utilization * 45;
        reasons.push(`gate utilization ${Math.round(utilization * 100)}%`);
        riskFactors.push({
          factor: 'gate_utilization',
          impact: Math.round(utilization * 45 * 10) / 10,
          description: `${Math.round(utilization * 100)}% capacity in use`,
        });

        if (cap.isPeakHour) {
          riskScore += 25;
          reasons.push('peak-hour congestion');
          riskFactors.push({
            factor: 'peak_hour',
            impact: 25,
            description: 'Slot sits inside the afternoon peak window',
          });
        }

        if (yardOccupancyPct >= 80) {
          riskScore += 20;
          reasons.push(`${yardZone} yard occupancy at ${Math.round(yardOccupancyPct)}%`);
          riskFactors.push({
            factor: 'yard_overload',
            impact: 20,
            description: `${yardZone} is heavily occupied`,
          });
        } else if (yardOccupancyPct >= 60) {
          riskScore += 10;
          reasons.push(`${yardZone} yard occupancy at ${Math.round(yardOccupancyPct)}%`);
          riskFactors.push({
            factor: 'yard_pressure',
            impact: 10,
            description: `${yardZone} is moderately occupied`,
          });
        }

        if (disruptionPenalty > 0) {
          riskScore += disruptionPenalty;
          reasons.push(`active disruption affecting ${yardZone}`);
          riskFactors.push({
            factor: 'active_disruption',
            impact: disruptionPenalty,
            description: `Current disruption touches ${yardZone}`,
          });
        }

        // Cargo soft-quota pressure
        const quotaShare = CARGO_SOFT_QUOTA[cargoType];
        const quotaCap = Math.ceil(cap.maxSlots * quotaShare);
        const cargoUsed = cargoType === CargoType.REEFER ? cap.reeferSlotsUsed : cargoType === CargoType.OOG ? cap.oogSlotsUsed : cap.drySlotsUsed;
        const quotaUtilization = cargoUsed / Math.max(quotaCap, 1);
        if (quotaUtilization >= 1) {
          riskScore += 35;
          riskFactors.push({
            factor: 'cargo_quota_full',
            impact: 35,
            description: `${cargoType} quota saturated for this window (${cargoUsed}/${quotaCap})`,
          });
          reasons.push(`${cargoType.toLowerCase()} quota saturated`);
        } else if (quotaUtilization >= 0.7) {
          riskScore += 12;
          riskFactors.push({
            factor: 'cargo_quota_tight',
            impact: 12,
            description: `${cargoType} quota nearly full (${cargoUsed}/${quotaCap})`,
          });
        }

        if (cargoType === CargoType.REEFER) {
          riskScore -= 5;
          reasons.push('reefer urgency mitigation');
          riskFactors.push({
            factor: 'reefer_priority',
            impact: -5,
            description: 'Cold-chain handling gets mitigation priority',
          });
        }

        if (cargoType === CargoType.OOG) {
          // OOG needs dedicated equipment; small bias toward off-peak.
          if (cap.isPeakHour) {
            riskScore += 10;
            riskFactors.push({
              factor: 'oog_peak_avoidance',
              impact: 10,
              description: 'OOG cargo prefers off-peak windows',
            });
          } else {
            riskScore -= 4;
            riskFactors.push({
              factor: 'oog_offpeak_bonus',
              impact: -4,
              description: 'Off-peak slot picked for OOG cargo',
            });
          }
        }

        if (isPriority && riskScore < 80) {
          riskScore -= 10;
          reasons.push('priority booking mitigation');
          riskFactors.push({
            factor: 'priority_booking',
            impact: -10,
            description: 'Priority request lowers acceptable queue tolerance',
          });
        }

        if (priorityScore > 6) {
          riskScore -= 5;
          riskFactors.push({
            factor: 'dynamic_priority_score',
            impact: -5,
            description: `Dynamic priority score ${priorityScore.toFixed(2)} elevates this slot`,
          });
        }

        if (requestedTime) {
          const deltaHours = Math.abs(cap.startTime.getTime() - new Date(requestedTime).getTime()) / (1000 * 60 * 60);
          if (deltaHours > 2) {
            riskScore += Math.min(deltaHours * 2, 10);
            riskFactors.push({
              factor: 'time_misalignment',
              impact: Math.min(Math.round(deltaHours * 20) / 10, 10),
              description: `Shifted ${deltaHours.toFixed(1)}h from requested arrival`,
            });
          } else {
            reasons.push('aligned with requested time');
          }
        }

        if (cap.usedSlots >= cap.maxSlots || cap.status === 'CLOSED') {
          riskScore = 100;
          reasons.push('gate slot full');
        }

        const clampedRiskScore = Math.min(Math.max(riskScore, 0), 100);
        const gateLabel =
          cap.usedSlots >= cap.maxSlots || cap.status === 'CLOSED'
            ? 'Gate Full'
            : cap.isPeakHour || utilization >= 0.9 || cap.status === 'RESTRICTED'
              ? 'Peak Risk'
              : 'Gate Available';
        const routeJson = this.buildRoute(container, cap);
        const predictedWaitMin = Math.max(8, Math.round((utilization * 35) + (cap.isPeakHour ? 18 : 6) + (yardOccupancyPct >= 80 ? 10 : 0)));
        const explanation = `Recommended because ${reasons.join(', ')}.`;

        const gateValidation = validateGate({
          slotStart: cap.startTime,
          slotEnd: cap.endTime,
          usedSlots: cap.usedSlots,
          maxSlots: cap.maxSlots,
          isPeakHour: cap.isPeakHour,
          status: cap.status,
          cargoType,
          cargoSlotsUsed: cargoUsed,
          activeIncidentForGate: activeDisruptions.length > 0,
        });

        return {
          start: cap.startTime,
          end: cap.endTime,
          riskScore: clampedRiskScore,
          explanation,
          routeJson,
          assignedGate: String(routeJson.gate),
          predictedWaitMin,
          validationTrace: {
            gateCapacity: gateLabel,
            yardZone,
            disruptionCount: activeDisruptions.length,
            utilizationPct: Math.round(utilization * 100),
            requestedTime: requestedTime?.toISOString() ?? null,
            cargoType,
            cargoQuotaShare: quotaShare,
            cargoQuotaUsed: cargoUsed,
            cargoQuotaCap: quotaCap,
            priorityScore,
          },
          riskFactors,
          gateCapacity: {
            status: gateValidation.status,
            label: gateValidation.label,
            detail: gateValidation.detail,
            slotStart: cap.startTime,
            slotEnd: cap.endTime,
            utilizationPct: Math.round(utilization * 100),
            availableSlots: gateValidation.availableSlots,
            cargoQuotaShare: quotaShare,
            cargoQuotaUsed: cargoUsed,
            cargoQuotaCap: quotaCap,
          },
        };
      })
      .filter((slot) => slot.gateCapacity.status !== 'FAIL');
  }

  private buildRoute(container: any, capacity: { startTime: Date; isPeakHour: boolean }) {
    const yardZone = container.yardZone ?? 'ZONE_A';
    const gate =
      yardZone === 'ZONE_B' ? 'GATE_2' :
      yardZone === 'ZONE_REEFER' ? 'GATE_COLD' :
      capacity.isPeakHour ? 'GATE_2' :
      'GATE_1';
    const exitGate = gate === 'GATE_2' ? 'EXIT_SOUTH' : gate === 'GATE_COLD' ? 'EXIT_REEFER' : 'EXIT_MAIN';
    const etaToGateMinutes =
      yardZone === 'ZONE_B' ? 18 :
      yardZone === 'ZONE_REEFER' ? 20 :
      12;
    const distanceKm =
      yardZone === 'ZONE_B' ? 14.8 :
      yardZone === 'ZONE_REEFER' ? 16.2 :
      10.4;

    return {
      gate,
      yardZone,
      exitGate,
      etaToGateMinutes,
      distanceKm,
      suggestedArrivalTime: new Date(capacity.startTime.getTime() - etaToGateMinutes * 60 * 1000).toISOString(),
      steps: ['Driver staging lane', gate, yardZone, exitGate],
    };
  }

  // --- 3. Re-optimization Trigger ---

  async triggerDisruptionReoptimization(disruptionId: string) {
    await this.orchestrationQueue.add('reoptimize-impacted', { disruptionId });
    this.logger.log(`Queued re-optimization for Disruption ${disruptionId}`);
  }

  async reoptimizeImpactedBookings(disruptionId: string) {
    const disruption = await this.prisma.disruption.findUnique({
      where: { id: disruptionId },
    });
    if (!disruption) return { impactedCount: 0, rescheduledCount: 0, failedCount: 0 };

    this.logger.log(`Running Re-optimization for: ${disruption.description}`);

    const disruptionEnd = disruption.endTime ?? new Date(disruption.startTime.getTime() + 2 * 60 * 60 * 1000);
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED] },
      },
      include: {
        request: {
          include: {
            company: true,
            container: {
              include: { vessel: true },
            },
            recommendation: true,
          },
        },
        assignments: true,
      },
    });

    const impactedBookings = bookings.filter((booking) => {
      const yardZone = booking.request.container.yardZone ?? '';
      const routeJson = (booking.assignments[0]?.routeJson as Record<string, unknown> | null)
        ?? (booking.request.recommendation?.routeJson as Record<string, unknown> | null)
        ?? {};
      const gate = String(routeJson.gate ?? '');
      const overlaps =
        booking.confirmedSlotStart < disruptionEnd &&
        booking.confirmedSlotEnd > disruption.startTime;

      return (
        disruption.affectedZones.includes(yardZone) ||
        (gate.length > 0 && disruption.affectedZones.includes(gate)) ||
        overlaps
      );
    });

    let rescheduledCount = 0;
    let failedCount = 0;

    for (const booking of impactedBookings) {
      const searchStart = this.maxDate(
        booking.request.container.crt ? new Date(booking.request.container.crt) : booking.confirmedSlotEnd,
        new Date(booking.confirmedSlotEnd.getTime() + 60 * 60 * 1000),
        new Date(disruptionEnd.getTime() + 60 * 60 * 1000),
      );

      const cargoType = resolveCargoType({
        isReefer: booking.request.container.isReefer,
        isOog: booking.request.container.isOog,
        cargoType: booking.request.container.cargoType,
      });

      const slots = await this.findCapacityAwareSlots({
        crt: searchStart,
        container: booking.request.container,
        cargoType,
        isPriority: booking.request.priority,
        priorityScore: booking.request.priorityScore ?? 0,
        requestedTime: searchStart,
        limit: 16,
      });

      const alternative = slots.find(
        (slot) => slot.start.getTime() !== booking.confirmedSlotStart.getTime(),
      );

      if (!alternative) {
        failedCount += 1;
        const blocked = await this.prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.BLOCKED,
            blockedReason: `No alternative slot found after ${disruption.type}`,
          },
        });

        await this.notifyCompany(
          booking.request.companyId,
          'Booking Blocked',
          `No replacement slot was found for ${booking.request.container.containerNo} after ${disruption.type}.`,
          'ERROR',
        );

        this.emitBookingUpdated({
          bookingId: blocked.id,
          requestId: blocked.requestId,
          newStatus: BookingStatus.BLOCKED,
          status: BookingStatus.BLOCKED,
          reason: blocked.blockedReason ?? undefined,
          slotStart: blocked.confirmedSlotStart.toISOString(),
          slotEnd: blocked.confirmedSlotEnd.toISOString(),
          containerNo: booking.request.container.containerNo,
        });
        continue;
      }

      const updatedBooking = await this.prisma.$transaction(async (tx) => {
        await tx.gateCapacity.updateMany({
          where: {
            startTime: booking.confirmedSlotStart,
            endTime: booking.confirmedSlotEnd,
            usedSlots: { gt: 0 },
          },
          data: { usedSlots: { decrement: 1 } },
        });
        await tx.gateCapacity.updateMany({
          where: {
            startTime: booking.confirmedSlotStart,
            endTime: booking.confirmedSlotEnd,
            ...(cargoType === CargoType.REEFER ? { reeferSlotsUsed: { gt: 0 } } : cargoType === CargoType.OOG ? { oogSlotsUsed: { gt: 0 } } : { drySlotsUsed: { gt: 0 } }),
          },
          data:
            cargoType === CargoType.REEFER
              ? { reeferSlotsUsed: { decrement: 1 } }
              : cargoType === CargoType.OOG
                ? { oogSlotsUsed: { decrement: 1 } }
                : { drySlotsUsed: { decrement: 1 } },
        });

        await tx.gateCapacity.updateMany({
          where: {
            startTime: alternative.start,
            endTime: alternative.end,
          },
          data: { usedSlots: { increment: 1 } },
        });
        await tx.gateCapacity.updateMany({
          where: {
            startTime: alternative.start,
            endTime: alternative.end,
          },
          data:
            cargoType === CargoType.REEFER
              ? { reeferSlotsUsed: { increment: 1 } }
              : cargoType === CargoType.OOG
                ? { oogSlotsUsed: { increment: 1 } }
                : { drySlotsUsed: { increment: 1 } },
        });

        await tx.assignment.updateMany({
          where: { bookingId: booking.id, type: 'PICKUP' },
          data: {
            routeJson: alternative.routeJson,
          },
        });

        await tx.recommendation.updateMany({
          where: { requestId: booking.requestId },
          data: {
            slotStart: alternative.start,
            slotEnd: alternative.end,
            routeJson: alternative.routeJson,
            riskScore: alternative.riskScore,
            explanation: alternative.explanation,
          },
        });

        return tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.RESCHEDULED,
            confirmedSlotStart: alternative.start,
            confirmedSlotEnd: alternative.end,
            blockedReason: `Rescheduled due to ${disruption.type}`,
          },
        });
      });

      rescheduledCount += 1;

      await this.notifyCompany(
        booking.request.companyId,
        'Booking Rescheduled',
        `Container ${booking.request.container.containerNo} moved to ${alternative.start.toISOString()} because of ${disruption.type}.`,
        'WARNING',
      );

      this.emitBookingUpdated({
        bookingId: updatedBooking.id,
        requestId: updatedBooking.requestId,
        newStatus: BookingStatus.RESCHEDULED,
        status: BookingStatus.RESCHEDULED,
        reason: updatedBooking.blockedReason ?? undefined,
        slotStart: updatedBooking.confirmedSlotStart.toISOString(),
        slotEnd: updatedBooking.confirmedSlotEnd.toISOString(),
        containerNo: booking.request.container.containerNo,
      });
    }

    return {
      impactedCount: impactedBookings.length,
      rescheduledCount,
      failedCount,
    };
  }

  private emitBookingUpdated(payload: BookingUpdatedPayload) {
    this.events.emit(EVENTS.BOOKING_UPDATED, payload);
  }

  private async notifyCompany(companyId: string, title: string, message: string, type: NotificationPayload['type']) {
    const user = await this.prisma.user.findFirst({ where: { companyId } });
    if (!user) return;

    const notification = await this.prisma.notification.create({
      data: {
        userId: user.id,
        title,
        message,
        type,
      },
    });

    const payload: NotificationPayload = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type,
      createdAt: notification.createdAt.toISOString(),
    };
    this.events.emit(EVENTS.NOTIFICATION_CREATED, payload);
  }

  private maxDate(...dates: Date[]) {
    return new Date(Math.max(...dates.map((date) => date.getTime())));
  }
}

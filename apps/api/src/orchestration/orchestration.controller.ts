import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Orchestration Engine')
@ApiBearerAuth()
@Controller('engine')
@UseGuards(RolesGuard)
export class OrchestrationController {
  constructor(private readonly service: OrchestrationService) {}

  @Post('recompute/:requestId')
  @Roles(Role.PORT_OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Force re-calculate CRT and Slots for a request' })
  async recompute(@Param('requestId') requestId: string) {
    return this.service.generateRecommendation(requestId);
  }

  @Post('reoptimize')
  @Roles(Role.PORT_OPERATOR, Role.ADMIN, Role.TOS_SYSTEM)
  @ApiOperation({ summary: 'Trigger disruption re-optimization manually' })
  async triggerReoptimization(@Body('disruptionId') disruptionId: string) {
    await this.service.triggerDisruptionReoptimization(disruptionId);
    return { ok: true, message: 'Re-optimization job queued' };
  }
}
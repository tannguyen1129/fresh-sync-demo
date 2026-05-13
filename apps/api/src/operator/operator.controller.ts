import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OperatorService } from './operator.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { 
  CreateGateCapacityDto, 
  UpdatePriorityRulesDto, 
  BlockResourceDto 
} from './dto/operator.dto';
import { CreateDisruptionDto, CreateDisruptionSchema } from '@freshsync/shared';

@ApiTags('Port Operator (Control Tower)')
@ApiBearerAuth()
@Controller('operator')
@UseGuards(RolesGuard)
@Roles(Role.PORT_OPERATOR, Role.ADMIN)
export class OperatorController {
  constructor(private service: OperatorService) {}

  // --- Capacity ---

  @Post('capacity/gate')
  @ApiOperation({ summary: 'Set Gate Capacity for a time slot' })
  createCapacity(@Body() dto: CreateGateCapacityDto) {
    return this.service.createGateCapacity(dto);
  }

  @Get('capacity/gate')
  @ApiOperation({ summary: 'Get Gate Capacity list' })
  getCapacities(
      @Query('from') from: string,
      @Query('to') to: string
  ) {
      return this.service.getGateCapacities(new Date(from), new Date(to));
  }

  @Post('disruptions')
  @ApiOperation({ summary: 'Create disruption from Control Tower' })
  createDisruption(
    @Body(new ZodValidationPipe(CreateDisruptionSchema)) dto: CreateDisruptionDto,
    @GetUser('sub') userId: string,
  ) {
    return this.service.createDisruption(dto, userId);
  }

  @Get('disruptions')
  @ApiOperation({ summary: 'List active disruptions' })
  getDisruptions() {
    return this.service.getDisruptions();
  }

  // --- Rules ---

  @Post('rules/priority')
  @ApiOperation({ summary: 'Update Priority Logic Rules (JSON)' })
  updateRules(@Body() dto: UpdatePriorityRulesDto, @GetUser('sub') userId: string) {
    return this.service.updatePriorityRules(dto, userId);
  }

  @Get('rules/priority')
  getRules() {
    return this.service.getPriorityRules();
  }

  // --- Override ---

  @Post('override/block')
  @ApiOperation({ summary: 'Manual Block (Zone/Gate/Container)' })
  blockResource(@Body() dto: BlockResourceDto, @GetUser('sub') userId: string) {
    return this.service.blockResource(dto, userId);
  }

  // --- Monitor ---

  @Get('monitor/congestion')
  @ApiOperation({ summary: 'Get Realtime Congestion Metrics' })
  getCongestion() {
    return this.service.getCongestionMetrics();
  }

  @Get('monitor/impacted')
  @ApiOperation({ summary: 'List recently impacted bookings' })
  getImpacted() {
    return this.service.getImpactedBookings();
  }

  @Post('playground/reset')
  @ApiOperation({ summary: 'Reset Sprint 4 demo scenario' })
  resetPlayground() {
    return this.service.resetDemoScenario();
  }

  @Get('map/snapshot')
  @ApiOperation({ summary: 'Get live map snapshot for control tower' })
  getMapSnapshot() {
    return this.service.getMapSnapshot();
  }

  @Post('scenarios/:type/start')
  @ApiOperation({ summary: 'Trigger a rescue-demo scenario for live map and congestion simulation' })
  startScenario(@Param('type') type: string, @GetUser('sub') userId: string) {
    return this.service.startScenario(type, userId);
  }

  @Post('scenarios/reset')
  @ApiOperation({ summary: 'Reset live simulation state back to seeded demo defaults' })
  resetScenarios() {
    return this.service.resetDemoScenario();
  }
}

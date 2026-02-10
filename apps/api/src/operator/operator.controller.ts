import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OperatorService } from './operator.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/current-user.decorator';
import { 
  CreateGateCapacityDto, 
  UpdatePriorityRulesDto, 
  BlockResourceDto 
} from './dto/operator.dto';

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
}
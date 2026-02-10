import { 
  Body, 
  Controller, 
  Get, 
  Param, 
  Post, 
  UseGuards, 
  UsePipes 
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { DriverService } from './driver.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { 
  UpdateAssignmentStatusSchema, 
  UpdateAssignmentStatusDto, 
  StartReturnEmptySchema, 
  StartReturnEmptyDto 
} from '@freshsync/shared';

@ApiTags('Driver App')
@ApiBearerAuth()
@Controller('driver')
@UseGuards(RolesGuard)
@Roles(Role.TRUCK_DRIVER)
export class DriverController {
  constructor(private service: DriverService) {}

  @Get('assignments')
  @ApiOperation({ summary: 'Get active assignments (Today + Upcoming)' })
  getMyAssignments(@GetUser('driverId') driverId: string) {
    // Note: driverId is injected into JWT payload during login
    return this.service.getMyAssignments(driverId);
  }

  @Post('assignments/:id/status')
  @ApiOperation({ summary: 'Update status (Enroute, Arrived, Delivered...)' })
  @ApiParam({ name: 'id', type: 'string' })
  @UsePipes(new ZodValidationPipe(UpdateAssignmentStatusSchema))
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentStatusDto
  ) {
    return this.service.updateStatus(id, dto);
  }

  @Post('return-empty')
  @ApiOperation({ summary: 'Request Smart Empty Return (Find best depot)' })
  @UsePipes(new ZodValidationPipe(StartReturnEmptySchema))
  returnEmpty(
    @Body() dto: StartReturnEmptyDto,
    @GetUser('sub') userId: string // Pass userId or driverId as needed
  ) {
    return this.service.requestEmptyReturn(userId, dto);
  }
}
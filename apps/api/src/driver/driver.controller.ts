import { 
  Body, 
  Controller, 
  Get, 
  Param, 
  Post, 
  UseGuards
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
  QrCheckInSchema,
  QrCheckInDto,
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

  @Get('tasks/today')
  @ApiOperation({ summary: 'Get today tasks in driver-friendly format' })
  getTodayTasks(@GetUser('driverId') driverId: string) {
    return this.service.getTodayTasks(driverId);
  }

  @Post('assignments/:id/status')
  @ApiOperation({ summary: 'Update status (Enroute, Arrived, Delivered...)' })
  @ApiParam({ name: 'id', type: 'string' })
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAssignmentStatusSchema)) dto: UpdateAssignmentStatusDto
  ) {
    return this.service.updateStatus(id, dto);
  }

  @Post('return-empty')
  @ApiOperation({ summary: 'Request Smart Empty Return (Find best depot)' })
  returnEmpty(
    @Body(new ZodValidationPipe(StartReturnEmptySchema)) dto: StartReturnEmptyDto,
    @GetUser('driverId') driverId: string,
  ) {
    return this.service.requestEmptyReturn(driverId, dto);
  }

  @Post('bookings/:id/check-in')
  @ApiOperation({ summary: 'Validate QR token and mark booking checked-in' })
  @ApiParam({ name: 'id', type: 'string' })
  checkIn(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(QrCheckInSchema)) dto: QrCheckInDto,
    @GetUser('driverId') driverId: string,
  ) {
    return this.service.checkInBooking(driverId, id, dto);
  }

  @Get('tasks/:id/qr')
  @ApiOperation({ summary: 'Get QR check-in package for a driver task' })
  @ApiParam({ name: 'id', type: 'string' })
  getTaskQr(@Param('id') id: string, @GetUser('driverId') driverId: string) {
    return this.service.getTaskQr(driverId, id);
  }
}

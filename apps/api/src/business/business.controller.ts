import { 
  BadRequestException,
  Body, 
  Controller, 
  Get, 
  Param, 
  Post, 
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { 
  CreatePickupRequestSchema, 
  CreatePickupRequestDto, 
  ConfirmBookingSchema, 
  ConfirmBookingDto 
} from '@freshsync/shared';

@ApiTags('Business Portal (Logistics)')
@ApiBearerAuth()
@Controller('business')
@UseGuards(RolesGuard)
@Roles(Role.LOGISTICS_COORDINATOR, Role.ADMIN) // Chỉ Business User
export class BusinessController {
  constructor(private service: BusinessService) {}

  @Post('pickup-requests')
  @ApiOperation({ summary: 'Submit Pickup Request & Get Recommendation' })
  createRequest(
    @Body(new ZodValidationPipe(CreatePickupRequestSchema)) dto: CreatePickupRequestDto,
    @GetUser('companyId') companyId: string,
  ) {
    return this.service.createPickupRequest(companyId, dto);
  }

  @Get('recommendations/:requestId')
  @ApiOperation({ summary: 'Get Recommendation Result' })
  @ApiParam({ name: 'requestId', type: 'string' })
  getRecommendation(
    @Param('requestId') requestId: string,
    @GetUser('companyId') companyId: string,
  ) {
    return this.service.getRecommendation(requestId, companyId);
  }

  @Post('bookings/:requestId/confirm')
  @ApiOperation({ summary: 'Confirm Booking & Reserve Slot' })
  confirmBooking(
    @Param('requestId') requestId: string,
    @Body(new ZodValidationPipe(ConfirmBookingSchema)) dto: ConfirmBookingDto,
    @GetUser('companyId') companyId: string,
  ) {
    if (dto.requestId !== requestId) {
      throw new BadRequestException('Request ID mismatch');
    }
    return this.service.confirmBooking(companyId, dto);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List My Bookings' })
  getMyBookings(@GetUser('companyId') companyId: string) {
    return this.service.getMyBookings(companyId);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List My Pickup Requests' })
  getMyRequests(@GetUser('companyId') companyId: string) {
    return this.service.getMyRequests(companyId);
  }

  @Get('reports/roi')
  @ApiOperation({ summary: 'Get ROI and sustainability metrics for my company' })
  getRoiReport(
    @GetUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getRoiReport(companyId, from, to);
  }
}

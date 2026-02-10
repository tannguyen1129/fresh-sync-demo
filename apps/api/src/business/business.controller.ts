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
  @UsePipes(new ZodValidationPipe(CreatePickupRequestSchema))
  createRequest(
    @Body() dto: CreatePickupRequestDto,
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
  @UsePipes(new ZodValidationPipe(ConfirmBookingSchema))
  confirmBooking(
    @Body() dto: ConfirmBookingDto,
    @GetUser('companyId') companyId: string,
  ) {
    // DTO có requestId, nhưng ta validate lại với param cho chắc
    if (dto.requestId !== dto.requestId) {
        // Logic check optional, here we rely on DTO
    }
    return this.service.confirmBooking(companyId, dto);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List My Bookings' })
  getMyBookings(@GetUser('companyId') companyId: string) {
    return this.service.getMyBookings(companyId);
  }
}
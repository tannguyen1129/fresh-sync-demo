import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { 
  IngestDOUpdateSchema, IngestDOUpdateDto,
  IngestVesselDelaySchema, IngestVesselDelayDto,
  CreateDisruptionSchema, CreateDisruptionDto
} from '@freshsync/shared';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(RolesGuard)
export class IntegrationsController {
  constructor(private service: IntegrationsService) {}

  // --- Shipping Line Endpoints ---

  @Post('shippingline/delivery-orders')
  @Roles(Role.SHIPPING_LINE_SYSTEM, Role.ADMIN) // Auth Requirement
  @ApiOperation({ summary: 'Update D/O Status (Trigger Hold Logic)' })
  updateDO(@Body(new ZodValidationPipe(IngestDOUpdateSchema)) dto: IngestDOUpdateDto, @GetUser('sub') userId: string) {
    return this.service.updateDOStatus(dto, userId);
  }

  @Post('shippingline/vessels')
  @Roles(Role.SHIPPING_LINE_SYSTEM, Role.ADMIN)
  @ApiOperation({ summary: 'Update Vessel ETA' })
  updateVessel(@Body(new ZodValidationPipe(IngestVesselDelaySchema)) dto: IngestVesselDelayDto, @GetUser('sub') userId: string) {
    return this.service.updateVessel(dto, userId);
  }

  @Post('shippingline/empty-return-instructions')
  @Roles(Role.SHIPPING_LINE_SYSTEM, Role.ADMIN)
  @ApiOperation({ summary: 'Push Empty Return Instructions' })
  ingestInstructions(@Body() body: any, @GetUser('sub') userId: string) {
      // Demo: Placeholder
      return { ok: true, message: "Instructions received" };
  }

  // --- TOS Endpoints ---

  @Post('tos/disruptions')
  @Roles(Role.TOS_SYSTEM, Role.ADMIN) // Auth Requirement
  @ApiOperation({ summary: 'Report Incident/Disruption' })
  reportDisruption(@Body(new ZodValidationPipe(CreateDisruptionSchema)) dto: CreateDisruptionDto, @GetUser('sub') userId: string) {
    return this.service.reportDisruption(dto, userId);
  }

  @Post('tos/status')
  @Roles(Role.TOS_SYSTEM, Role.ADMIN)
  @ApiOperation({ summary: 'Ingest Yard/Gate Snapshot' })
  ingestSnapshot(@Body() body: any, @GetUser('sub') userId: string) {
    return this.service.updateYardSnapshot(body, userId);
  }
}

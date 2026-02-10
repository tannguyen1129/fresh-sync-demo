import { Controller, Get, Post, Query, Res, UseGuards, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { EsgService } from './esg.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Port Authority (ESG)')
@ApiBearerAuth()
@Controller('authority/esg')
@UseGuards(RolesGuard)
@Roles(Role.PORT_AUTHORITY, Role.ADMIN)
export class EsgController {
  constructor(private service: EsgService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Calculate ESG metrics for a specific date' })
  @ApiQuery({ name: 'date', example: '2023-10-25' })
  generateReport(@Query('date') date: string) {
    // Basic validation
    if (!date || isNaN(Date.parse(date))) {
        return { error: "Invalid date format (YYYY-MM-DD)" };
    }
    return this.service.generateDailyReport(date);
  }

  @Get()
  @ApiOperation({ summary: 'Get ESG reports' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getReports(
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.service.getReports(from, to);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export ESG data as CSV' })
  async exportCsv(@Res({ passthrough: true }) res: Response) {
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="freshsync-esg-report.csv"',
    });
    return this.service.exportCsv();
  }
}
import { Controller, Get } from '@nestjs/common';
import { HealthCheckResponse, HealthCheckSchema } from '@freshsync/shared';

@Controller()
export class AppController {
  @Get('health')
  getHealth(): HealthCheckResponse {
    const response: HealthCheckResponse = {
      ok: true,
      service: 'FreshSync API',
      timestamp: new Date().toISOString()
    };
    
    // Validate response using shared Zod schema (optional demo)
    return HealthCheckSchema.parse(response);
  }
}
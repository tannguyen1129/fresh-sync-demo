import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { OrchestrationModule } from 'src/orchestration/orchestration.module';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  imports: [OrchestrationModule],
})
export class IntegrationsModule {}
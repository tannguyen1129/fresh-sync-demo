import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrchestrationController } from './orchestration.controller';
import { OrchestrationService } from './orchestration.service';
import { OrchestrationProcessor } from './orchestration.processor';
import { EventsModule } from '../gateway/events.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'orchestration',
    }),
    EventsModule,
  ],
  controllers: [OrchestrationController],
  providers: [OrchestrationService, OrchestrationProcessor],
  exports: [OrchestrationService], // Export để Module khác dùng (VD: Integrations)
})
export class OrchestrationModule {}
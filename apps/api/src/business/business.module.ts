import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { OrchestrationModule } from '../orchestration/orchestration.module'; 
import { EventsModule } from '../gateway/events.module';

@Module({
  imports: [
    OrchestrationModule,
    EventsModule,
  ],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
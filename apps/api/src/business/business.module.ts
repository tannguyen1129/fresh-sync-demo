import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { OrchestrationModule } from '../orchestration/orchestration.module'; 
import { EventsModule } from '../gateway/events.module';
import { EsgModule } from '../esg/esg.module';

@Module({
  imports: [
    OrchestrationModule,
    EventsModule,
    EsgModule,
  ],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}

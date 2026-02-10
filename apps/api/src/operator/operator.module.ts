import { Module } from '@nestjs/common';
import { OperatorController } from './operator.controller';
import { OperatorService } from './operator.service';
import { OrchestrationModule } from '../orchestration/orchestration.module'; // Import Engine

@Module({
  imports: [OrchestrationModule],
  controllers: [OperatorController],
  providers: [OperatorService],
})
export class OperatorModule {}
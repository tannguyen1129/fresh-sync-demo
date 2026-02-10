import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';

@Processor('orchestration')
export class OrchestrationProcessor extends WorkerHost {
  private readonly logger = new Logger(OrchestrationProcessor.name);

  constructor(private readonly orchestrationService: OrchestrationService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'reoptimize-impacted':
        this.logger.log(`Processing Job: ${job.name} for Disruption ${job.data.disruptionId}`);
        await this.orchestrationService.reoptimizeImpactedBookings(job.data.disruptionId);
        break;
      
      case 'recompute-request':
          // Logic recompute single request
          break;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
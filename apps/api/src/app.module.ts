import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module'; // Import PrismaModule
import { AtGuard } from './auth/guards/at.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AppController } from './app.controller';
import { IntegrationsModule } from './integrations/integrations.module';
import { BullModule } from '@nestjs/bullmq';
import { BusinessModule } from './business/business.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { DriverModule } from './driver/driver.module';
import { OperatorModule } from './operator/operator.module';
import { EsgModule } from './esg/esg.module';

@Module({
  imports: [
    PrismaModule, // Đăng ký Global module
    AuthModule, 
    IntegrationsModule,
    OrchestrationModule,
    BusinessModule,
    DriverModule,
    OperatorModule,
    EsgModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: 6379,
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AtGuard,
    },
    {
        provide: APP_GUARD,
        useClass: RolesGuard,
    }
  ],
})
export class AppModule {}
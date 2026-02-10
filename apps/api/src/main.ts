import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);


  const logger = new Logger('NestApplication');
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  app.setGlobalPrefix('api'); 

  app.enableCors({
    // Cho phép Web gọi vào
    origin: ['https://freshsync.umtoj.edu.vn'], 
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('FreshSync API')
    .setDescription('Port-to-Business Orchestration')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // --- SỬA DÒNG NÀY ---
  // Thêm tham số '0.0.0.0' để lắng nghe trên tất cả địa chỉ IPv4
  await app.listen(process.env.PORT || 4000, '0.0.0.0'); 
  
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
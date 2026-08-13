import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino Logger
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  const apiPrefix = configService.get<string>('API_PREFIX') || '/api/v1';

  // Global Middlewares
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Setup OpenAPI Swagger Documentation at /docs
  setupSwagger(app);

  await app.listen(port);
  const pinoLogger = app.get(Logger);
  pinoLogger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix.replace(/^\//, '')}`);
  pinoLogger.log(`📚 OpenAPI Swagger docs available on: http://localhost:${port}/docs`);
}

bootstrap();

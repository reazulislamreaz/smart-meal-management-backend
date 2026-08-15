import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as compression from 'compression';
import * as express from 'express';
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
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: false,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
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

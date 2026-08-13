import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Smart Meal Management System API')
    .setDescription('Enterprise-grade NestJS REST API with PostgreSQL 17, Redis 7, JWT rotation, and RBAC.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'User Authentication & Session Management')
    .addTag('Users', 'User Management Operations')
    .addTag('Exports', 'ExcelJS & PDFKit Document Generation')
    .addTag('Health', 'System Health Check Endpoint')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

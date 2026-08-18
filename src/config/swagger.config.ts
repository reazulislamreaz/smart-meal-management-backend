import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Smart Meal Management System API')
    .setDescription('Enterprise-grade NestJS REST API with PostgreSQL 17, Redis 7, JWT rotation, and RBAC.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'User Authentication & Session Lifecycle')
    .addTag('Users', 'User Onboarding, Dashboard & Profile Management')
    .addTag('Meal Plans', 'AI Weekly Meal Plan Generation & Meal Schedules')
    .addTag('Meals', 'Master Recipe Catalog & Recipe Details')
    .addTag('Shopping List', 'Auto-Deducted Shopping List & Spend Tracker')
    .addTag('Pantry', 'Pantry Inventory & Low Stock Tracking')
    .addTag('Cookbook & Favourites', 'Cooked Meal History & Saved Recipes')
    .addTag('Tasks', 'Household Task Management')
    .addTag('Subscriptions', 'Stripe Billing, Plans & Coupon Validation')
    .addTag('Admin', 'Super Admin Dashboard, Analytics, Users & Coupon Management')
    .addTag('Content', 'Static Content & Legal Pages (Privacy Policy, About Us)')
    .addTag('Upload', 'Cloudinary / S3 Media Uploads')
    .addTag('Exports', 'ExcelJS & PDFKit Document Generation')
    .addTag('Health', 'System Health Check Endpoint')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
    },
  });
}


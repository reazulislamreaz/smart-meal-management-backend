import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication, publicUrl?: string): void {
  const builder = new DocumentBuilder()
    .setTitle('Smart Meal Management System (Sizzl / PlatePlan) API')
    .setDescription(
      `## Overview
Enterprise-grade NestJS RESTful API ecosystem powering AI meal planning, pantry inventory tracking, deductive grocery budgeting, household task delegation, and subscription management.

### Key Capabilities
- **AI Meal Planning & Swapping:** Dynamic weekly meal plans via OpenAI with live budget comparators, calorie estimations, and zero-repetition slot-specific swapping.
- **Pantry Inventory Management:** Direct positive quantity entry (\`500 g\`, \`1.5 L\`, \`2 kg\`), optional expiry dates, low-stock tracking, and automatic onboarding item synchronization.
- **Deductive Shopping List:** Auto-deducts existing pantry items from required recipe ingredients to eliminate food and financial waste.
- **Authentication & RBAC:** Dual-token architecture (15-minute Bearer JWT + 7-day HMAC-SHA256 refresh tokens) with Super Admin (\`SUPER_ADMIN\`) and User (\`USER\`) roles.

### Authentication Instructions
1. Authenticate via **\`POST /api/v1/auth/login\`** or register via **\`POST /api/v1/auth/register\`**.
2. Click the **Authorize 🔓** button at the top right of this page.
3. Enter your token in the format: \`Bearer <YOUR_JWT_TOKEN>\` and click **Authorize**.
      `,
    )
    .setVersion('1.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT access token in the format: Bearer <token>',
        in: 'header',
      },
      'bearer',
    )
    .addTag('Auth', 'User Authentication, Session Lifecycle & Token Refresh')
    .addTag('Users', 'User Onboarding, Dashboard, Profile & Password Management')
    .addTag('Meal Plans', 'AI Weekly Meal Plan Generation, Plan Review & Slot Swapping')
    .addTag('Meals', 'Master Recipe Catalog, Dietary Filtering & AI Recommendations')
    .addTag('Pantry', 'Pantry Stock Inventory, Optional Expiry & Direct Quantities')
    .addTag('Shopping List', 'Auto-Deducted Shopping List & Spend Tracker')
    .addTag('Cookbook & Favourites', 'Cooked Meal History & Saved Favourite Recipes')
    .addTag('Tasks', 'Household Task Management & Delegation')
    .addTag('Subscriptions', 'Stripe Billing, Plans & Coupon Validation')
    .addTag('Admin', 'Super Admin Analytics, User Management & Coupon Engine')
    .addTag(
      'Content',
      'Static Content & Legal Pages (Privacy Policy, Terms, About Us, Contact)',
    )
    .addTag('Upload', 'Cloudinary / AWS S3 Media File Uploads')
    .addTag('Exports', 'ExcelJS & PDFKit Document Generation')
    .addTag('Health', 'System Health & Liveness Check');

  const normalizedPublicUrl = publicUrl?.replace(/\/$/, '');
  if (normalizedPublicUrl) {
    builder.addServer(normalizedPublicUrl, 'Production Server');
  }
  builder.addServer('http://localhost:3000', 'Local Development Server');

  const config = builder.build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'Sizzl API Documentation & Explorer',
  });
}

import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_meal_db?schema=public';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding initial data...');

  const adminEmail = 'admin@smartmeal.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await argon2.hash('AdminPassword123!');
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'System',
        lastName: 'SuperAdmin',
        role: Role.SUPER_ADMIN,
        isEmailVerified: true,
      },
    });
    console.log(`Created default Super Admin user: ${admin.email}`);
  } else {
    console.log('Super Admin user already exists.');
  }

  // Seed candidate meals catalog
  const mealsCount = await prisma.meal.count();
  if (mealsCount === 0) {
    await prisma.meal.createMany({
      data: [
        {
          title: 'Chicken Caesar Wraps',
          description: 'Crispy chicken breast with fresh Romaine lettuce and Caesar dressing wrapped in warm tortillas',
          prepTimeMinutes: 15,
          servings: 4,
          estimatedCost: 20.0,
          cuisine: 'American',
          dietaryTags: ['HIGH_PROTEIN'],
          instructions: ['Cook chicken breast until golden', 'Mix salad with dressing', 'Wrap and slice'],
          ingredients: [
            { name: 'Chicken breast', category: 'Meat & Fish', quantity: '500g' },
            { name: 'Olive oil', category: 'Pantry Staples', quantity: '1 tbsp' },
            { name: 'Garlic', category: 'Produce', quantity: '2 cloves' },
            { name: 'Salt & pepper', category: 'Pantry Staples', quantity: 'to taste' },
            { name: 'Mixed veg', category: 'Produce', quantity: '400g' },
          ],
        },
        {
          title: 'Beef Chilli Jackets',
          description: 'Rich slow-cooked beef chilli served inside fluffy baked jacket potatoes with grated cheese',
          prepTimeMinutes: 30,
          servings: 4,
          estimatedCost: 22.5,
          cuisine: 'Mexican',
          dietaryTags: ['HIGH_PROTEIN', 'HALAL'],
          instructions: ['Bake potatoes for 45 mins', 'Simmer minced beef with chilli spices', 'Top potatoes with chilli and cheese'],
          ingredients: [
            { name: 'Beef mince', category: 'Meat & Fish', quantity: '500g' },
            { name: 'Potatoes', category: 'Produce', quantity: '4 large' },
            { name: 'Kidney beans', category: 'Pantry Staples', quantity: '1 can' },
            { name: 'Cheddar cheese', category: 'Dairy', quantity: '100g' },
          ],
        },
        {
          title: 'Chicken & Veg Traybake',
          description: 'Sheet-pan roasted chicken thighs with rosemary, sweet potatoes, and bell peppers',
          prepTimeMinutes: 25,
          servings: 4,
          estimatedCost: 18.0,
          cuisine: 'Mediterranean',
          dietaryTags: ['HIGH_PROTEIN', 'GLUTEN_FREE'],
          instructions: ['Chop vegetables', 'Toss with olive oil and herbs', 'Roast at 200°C for 35 mins'],
          ingredients: [
            { name: 'Chicken thighs', category: 'Meat & Fish', quantity: '600g' },
            { name: 'Sweet potato', category: 'Produce', quantity: '2 medium' },
            { name: 'Bell peppers', category: 'Produce', quantity: '2 pcs' },
            { name: 'Rosemary', category: 'Produce', quantity: '2 sprigs' },
          ],
        },
        {
          title: 'Halloumi & Couscous',
          description: 'Golden pan-fried halloumi cheese served over fluffy Mediterranean herb couscous',
          prepTimeMinutes: 15,
          servings: 4,
          estimatedCost: 16.5,
          cuisine: 'Mediterranean',
          dietaryTags: ['VEGETARIAN'],
          instructions: ['Sear halloumi slices', 'Steep couscous in vegetable broth', 'Combine and garnish with fresh herbs'],
          ingredients: [
            { name: 'Halloumi', category: 'Dairy', quantity: '250g' },
            { name: 'Couscous', category: 'Pantry Staples', quantity: '200g' },
            { name: 'Cherry tomatoes', category: 'Produce', quantity: '150g' },
            { name: 'Stock cube', category: 'Pantry Staples', quantity: '1 pc' },
          ],
        },
        {
          title: 'Salmon Rice Bowls',
          description: 'Pan-seared salmon fillet over steamed jasmine rice with avocado and teriyaki drizzle',
          prepTimeMinutes: 20,
          servings: 4,
          estimatedCost: 25.0,
          cuisine: 'Japanese',
          dietaryTags: ['PESCATARIAN', 'HIGH_PROTEIN'],
          instructions: ['Sear salmon fillets', 'Steam rice', 'Assemble bowl with sliced avocado and sauce'],
          ingredients: [
            { name: 'Salmon fillet', category: 'Meat & Fish', quantity: '4 fillets' },
            { name: 'Jasmine rice', category: 'Pantry Staples', quantity: '300g' },
            { name: 'Avocado', category: 'Produce', quantity: '2 pcs' },
            { name: 'Soy sauce', category: 'Pantry Staples', quantity: '2 tbsp' },
          ],
        },
      ],
    });
    console.log('Seeded candidate master meals catalog.');
  }

  // Seed default promo coupons
  const existingCoupon = await prisma.coupon.findUnique({ where: { code: 'MKA-2021' } });
  if (!existingCoupon) {
    await prisma.coupon.create({
      data: {
        code: 'MKA-2021',
        discountPercent: 50.0,
        maxRedemptions: 500,
        validUntil: new Date('2030-12-31'),
        isActive: true,
      },
    });
    console.log('Seeded promo coupon code MKA-2021 (50% Off).');
  }

  // Seed default static content pages
  const existingPrivacy = await prisma.staticPage.findUnique({ where: { slug: 'privacy-policy' } });
  if (!existingPrivacy) {
    await prisma.staticPage.createMany({
      data: [
        {
          slug: 'privacy-policy',
          title: 'Privacy Policy',
          content: 'Smart Meal Management (Sizzl) values your privacy. We collect household preferences, dietary requirements, and budget targets solely to generate personalized meal plans and inventory estimates. Your data is encrypted and never sold to third parties.',
        },
        {
          slug: 'about-us',
          title: 'About Sizzl / PlatePlan',
          content: 'Sizzl is an AI-driven smart meal planning, grocery inventory, and domestic task delegation ecosystem created to eliminate food waste, reduce household friction, and optimize weekly grocery spend.',
        },
      ],
    });
    console.log('Seeded static pages (Privacy Policy, About Us).');
  }

  // Seed default Subscription Plans
  const plansCount = await prisma.subscriptionPlan.count();
  if (plansCount === 0) {
    await prisma.subscriptionPlan.createMany({
      data: [
        {
          name: 'Monthly Premium',
          description: 'Full AI meal planning, smart grocery list, and household sync billed monthly',
          price: 7.99,
          interval: 'monthly',
          currency: 'USD',
          features: [
            'Unlimited AI Weekly Meal Plans',
            'Smart Pantry & Expiry Tracking',
            'Automated Shopping Lists with Deductions',
            'Family Household Sharing',
            'Nutritional Macro Breakdown',
          ],
          isPopular: true,
          isActive: true,
        },
        {
          name: 'Annual Plan',
          description: 'Save 37% with our annual subscription for continuous budget and meal optimization',
          price: 59.88,
          interval: 'yearly',
          currency: 'USD',
          features: [
            'All Monthly Premium Features',
            '2 Months Free (Save 37%)',
            'Priority AI Generation Speed',
            'Export to PDF & Excel',
            'Dedicated 24/7 Priority Support',
          ],
          discountPercent: 37.0,
          isPopular: false,
          isActive: true,
        },
      ],
    });
    console.log('Seeded default Subscription Plans.');
  }

  await prisma.$disconnect();
  await pool.end();
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  });

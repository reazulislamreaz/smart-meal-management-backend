import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
];

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/smart_meal_db?schema=public';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding initial database data...');

  const passwordHash = await argon2.hash('AdminPassword123!');

  // 1. Seed Super Admin users (both admin@sizzl.com and admin@smartmeal.com)
  const adminEmails = [
    { email: 'admin@sizzl.com', firstName: 'Bashar', lastName: 'Islam' },
    { email: 'admin@smartmeal.com', firstName: 'Super', lastName: 'Admin' },
  ];

  for (const adminData of adminEmails) {
    const existing = await prisma.user.findUnique({
      where: { email: adminData.email },
    });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: adminData.email,
          passwordHash,
          firstName: adminData.firstName,
          lastName: adminData.lastName,
          name: `${adminData.firstName} ${adminData.lastName}`,
          role: Role.SUPER_ADMIN,
          isEmailVerified: true,
          phoneNumber: '+1 181 948 8101',
          address: '742 Evergreen Terrace, Springfield, OR',
          avatarUrl: AVATARS[0],
        },
      });
      console.log(`Created Super Admin: ${adminData.email}`);
    } else {
      await prisma.user.update({
        where: { email: adminData.email },
        data: {
          passwordHash,
          role: Role.SUPER_ADMIN,
          name: `${adminData.firstName} ${adminData.lastName}`,
        },
      });
      console.log(`Updated Super Admin credentials: ${adminData.email}`);
    }
  }

  // 2. Seed realistic platform users
  const sampleUsers = [
    {
      name: 'Michael Rahman',
      email: 'michael.rahman@example.com',
      phone: '+1 202 555 0143',
      address: '450 West 33rd St, New York, NY',
      plan: 'Annual Plan',
      isBlocked: false,
    },
    {
      name: 'Philips Mark',
      email: 'philips.mark@example.com',
      phone: '+1 415 555 0192',
      address: '789 Mission St, San Francisco, CA',
      plan: 'Monthly Premium',
      isBlocked: false,
    },
    {
      name: 'James Dekker',
      email: 'james.dekker@example.com',
      phone: '+1 312 555 0177',
      address: '120 N LaSalle St, Chicago, IL',
      plan: 'Free Trial',
      isBlocked: true,
    },
    {
      name: 'Eliza Hernandez',
      email: 'eliza.h@example.com',
      phone: '+1 713 555 0184',
      address: '1001 Texas Ave, Houston, TX',
      plan: 'Annual Plan',
      isBlocked: false,
    },
    {
      name: 'Marco Williams',
      email: 'marco.williams@example.com',
      phone: '+1 617 555 0111',
      address: '200 Clarendon St, Boston, MA',
      plan: 'Monthly Premium',
      isBlocked: true,
    },
    {
      name: 'Sarah Jenkins',
      email: 'sarah.j@example.com',
      phone: '+1 206 555 0165',
      address: '1301 2nd Ave, Seattle, WA',
      plan: 'Annual Plan',
      isBlocked: false,
    },
    {
      name: 'David Miller',
      email: 'david.miller@example.com',
      phone: '+1 305 555 0128',
      address: '1111 Brickell Ave, Miami, FL',
      plan: 'Monthly Premium',
      isBlocked: false,
    },
    {
      name: 'Emma Watson',
      email: 'emma.watson@example.com',
      phone: '+1 404 555 0139',
      address: '191 Peachtree St, Atlanta, GA',
      plan: 'Annual Plan',
      isBlocked: false,
    },
  ];

  const userPasswordHash = await argon2.hash('UserPassword123!');

  for (let i = 0; i < sampleUsers.length; i++) {
    const u = sampleUsers[i];
    const nameParts = u.name.split(' ');
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
    });

    let dbUser = existing;
    if (!existing) {
      dbUser = await prisma.user.create({
        data: {
          email: u.email,
          passwordHash: userPasswordHash,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          name: u.name,
          phoneNumber: u.phone,
          address: u.address,
          role: Role.USER,
          isEmailVerified: true,
          isBlocked: u.isBlocked,
          avatarUrl: AVATARS[(i + 1) % AVATARS.length],
          weeklyBudget: 120 + i * 15,
        },
      });
    }

    // Ensure subscription exists
    if (dbUser) {
      const existingSub = await prisma.subscription.findFirst({
        where: { userId: dbUser.id },
      });
      if (!existingSub) {
        await prisma.subscription.create({
          data: {
            userId: dbUser.id,
            planName: u.plan,
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2027-01-01'),
          },
        });
      }

      // Add sample tasks
      const taskCount = await prisma.task.count({ where: { userId: dbUser.id } });
      if (taskCount === 0) {
        await prisma.task.createMany({
          data: [
            {
              userId: dbUser.id,
              title: 'Grocery Pickup at Walmart',
              description: 'Pick up weekly fresh produce and dairy',
              status: 'COMPLETED',
            },
            {
              userId: dbUser.id,
              title: 'Prep Chicken Caesar Wraps',
              description: 'Marinate chicken thighs and wash lettuce',
              status: 'PENDING',
            },
          ],
        });
      }
    }
  }

  // 3. Seed Subscription Pricing Plans
  const plans = [
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
  ];

  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { name: plan.name },
    });
    if (!existing) {
      await prisma.subscriptionPlan.create({ data: plan });
    }
  }

  // 4. Seed Master Meals Catalog
  const meals = [
    {
      title: 'Chicken & Veg Traybake',
      mealType: 'Dinner',
      cuisine: 'Mediterranean',
      prepTimeMinutes: 25,
      servings: 4,
      estimatedCost: 7.5,
      dietaryTags: ['HIGH_PROTEIN', 'GLUTEN_FREE'],
      instructions: ['Chop vegetables', 'Toss with olive oil and herbs', 'Roast at 200°C for 35 mins'],
      ingredients: [
        { name: 'Chicken thighs', category: 'Meat & Fish', quantity: '600g' },
        { name: 'Sweet potato', category: 'Produce', quantity: '2 medium' },
        { name: 'Bell peppers', category: 'Produce', quantity: '2 pcs' },
      ],
    },
    {
      title: 'Salmon Rice Bowls',
      mealType: 'Dinner',
      cuisine: 'Japanese',
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 8.0,
      dietaryTags: ['PESCATARIAN', 'HIGH_PROTEIN'],
      instructions: ['Sear salmon fillets', 'Steam rice', 'Assemble bowl with sliced avocado and sauce'],
      ingredients: [
        { name: 'Salmon fillet', category: 'Meat & Fish', quantity: '4 fillets' },
        { name: 'Jasmine rice', category: 'Pantry Staples', quantity: '300g' },
      ],
    },
    {
      title: 'Halloumi & Couscous',
      mealType: 'Dinner',
      cuisine: 'Mediterranean',
      prepTimeMinutes: 15,
      servings: 4,
      estimatedCost: 6.0,
      dietaryTags: ['VEGETARIAN'],
      instructions: ['Sear halloumi slices', 'Steep couscous in broth', 'Combine and garnish'],
      ingredients: [
        { name: 'Halloumi', category: 'Dairy', quantity: '250g' },
        { name: 'Couscous', category: 'Pantry Staples', quantity: '200g' },
      ],
    },
    {
      title: 'Avocado Toast & Poached Egg',
      mealType: 'Breakfast',
      cuisine: 'American',
      prepTimeMinutes: 10,
      servings: 2,
      estimatedCost: 4.5,
      dietaryTags: ['VEGETARIAN', 'HIGH_PROTEIN'],
      instructions: ['Toast sourdough slices', 'Mash avocado with lime and salt', 'Poach eggs and top'],
      ingredients: [
        { name: 'Sourdough bread', category: 'Bakery', quantity: '2 slices' },
        { name: 'Avocado', category: 'Produce', quantity: '1 pc' },
        { name: 'Eggs', category: 'Dairy', quantity: '2 pcs' },
      ],
    },
    {
      title: 'Overnight Chia Pudding',
      mealType: 'Breakfast',
      cuisine: 'American',
      prepTimeMinutes: 5,
      servings: 2,
      estimatedCost: 3.5,
      dietaryTags: ['VEGAN', 'GLUTEN_FREE'],
      instructions: ['Mix chia seeds with almond milk and maple syrup', 'Refrigerate overnight', 'Top with berries'],
      ingredients: [
        { name: 'Chia seeds', category: 'Pantry Staples', quantity: '4 tbsp' },
        { name: 'Almond milk', category: 'Dairy', quantity: '1 cup' },
        { name: 'Berries', category: 'Produce', quantity: '1/2 cup' },
      ],
    },
    {
      title: 'Chicken Caesar Wraps',
      mealType: 'Lunch',
      cuisine: 'American',
      prepTimeMinutes: 15,
      servings: 4,
      estimatedCost: 5.5,
      dietaryTags: ['HIGH_PROTEIN'],
      instructions: ['Cook chicken breast', 'Mix salad with Caesar dressing', 'Wrap in tortillas'],
      ingredients: [
        { name: 'Chicken breast', category: 'Meat & Fish', quantity: '400g' },
        { name: 'Tortillas', category: 'Bakery', quantity: '4 pcs' },
        { name: 'Romaine lettuce', category: 'Produce', quantity: '1 head' },
      ],
    },
    {
      title: 'Greek Quinoa Salad',
      mealType: 'Lunch',
      cuisine: 'Mediterranean',
      prepTimeMinutes: 15,
      servings: 4,
      estimatedCost: 6.2,
      dietaryTags: ['VEGETARIAN', 'GLUTEN_FREE'],
      instructions: ['Cook quinoa', 'Chop cucumbers, olives, and feta', 'Toss with vinaigrette'],
      ingredients: [
        { name: 'Quinoa', category: 'Pantry Staples', quantity: '200g' },
        { name: 'Feta cheese', category: 'Dairy', quantity: '150g' },
        { name: 'Cucumbers', category: 'Produce', quantity: '2 pcs' },
      ],
    },
    {
      title: 'Beef Chilli Jackets',
      mealType: 'Dinner',
      cuisine: 'Mexican',
      prepTimeMinutes: 30,
      servings: 4,
      estimatedCost: 7.2,
      dietaryTags: ['HIGH_PROTEIN', 'HALAL'],
      instructions: ['Bake potatoes', 'Simmer minced beef with spices', 'Top with sour cream and cheddar'],
      ingredients: [
        { name: 'Beef mince', category: 'Meat & Fish', quantity: '500g' },
        { name: 'Potatoes', category: 'Produce', quantity: '4 large' },
      ],
    },
    {
      title: 'Italian Pasta Primavera',
      mealType: 'Dinner',
      cuisine: 'Italian',
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 5.8,
      dietaryTags: ['VEGETARIAN'],
      instructions: ['Boil penne pasta al dente', 'Sauté zucchini and cherry tomatoes', 'Toss with parmesan'],
      ingredients: [
        { name: 'Penne pasta', category: 'Pantry Staples', quantity: '400g' },
        { name: 'Parmesan', category: 'Dairy', quantity: '80g' },
      ],
    },
  ];

  for (const meal of meals) {
    const existing = await prisma.meal.findFirst({
      where: { title: meal.title },
    });
    if (!existing) {
      await prisma.meal.create({
        data: {
          ...meal,
          description: `Delicious homemade ${meal.title.toLowerCase()} made with fresh ingredients.`,
          status: 'Active',
        },
      });
    }
  }

  // 5. Seed System Settings (Taxonomy, App Config, Banners)
  const defaultSettings = [
    { key: 'config_trialDays', value: '7' },
    { key: 'config_defaultHousehold', value: '4' },
    { key: 'config_aiModel', value: 'gpt-4o-mini' },
    { key: 'config_maxSuggestions', value: '5' },
    {
      key: 'diet_options',
      value: JSON.stringify([
        'Vegetarian',
        'Vegan',
        'Halal',
        'Kosher',
        'Gluten-free',
        'Dairy-free',
        'Nut-free',
        'Pescatarian',
        'High-protein',
      ]),
    },
    {
      key: 'cuisine_options',
      value: JSON.stringify([
        'Italian',
        'Mexican',
        'Asian',
        'Mediterranean',
        'American',
        'Indian',
        'Middle Eastern',
        'British',
        'Japanese',
      ]),
    },
    { key: 'banner_home', value: 'Welcome to Sizzl - Smart Meal Management & Pantry Optimizer' },
    { key: 'banner_savings', value: 'Save up to 40% on groceries with automated pantry deduction' },
    { key: 'banner_mealPlan', value: 'Personalized recipes customized to your household dietary matrix' },
    { key: 'banner_pantry', value: 'Zero Food Waste: Always know what ingredients you have in stock' },
    { key: 'contact_email', value: 'support@sizzl.com' },
    { key: 'contact_phone', value: '+1 181 948 8101' },
    { key: 'contact_address', value: '742 Evergreen Terrace, Springfield, OR' },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }

  // 6. Seed Static Pages (Privacy Policy, About Us)
  const staticPages = [
    {
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      content:
        'Smart Meal Management (Sizzl) values your privacy. We collect household preferences, dietary requirements, and budget targets solely to generate personalized meal plans and inventory estimates. Your data is encrypted and never sold to third parties.',
    },
    {
      slug: 'about-us',
      title: 'About us',
      content:
        'Sizzl is an AI-driven smart meal planning, grocery inventory, and domestic task delegation ecosystem created to eliminate food waste, reduce household friction, and optimize weekly grocery spend.',
    },
  ];

  for (const page of staticPages) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      update: { title: page.title, content: page.content },
      create: page,
    });
  }

  console.log('Database seeded successfully with SuperAdmin, users, meals, plans, and settings!');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Error during seeding:', e);
  process.exit(1);
});

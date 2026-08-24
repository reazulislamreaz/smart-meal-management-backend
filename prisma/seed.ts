import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const AVATARS = [
  'https://i.pravatar.cc/96?img=12',
  'https://i.pravatar.cc/96?img=32',
  'https://i.pravatar.cc/96?img=47',
  'https://i.pravatar.cc/96?img=5',
  'https://i.pravatar.cc/96?img=15',
  'https://i.pravatar.cc/96?img=11',
  'https://i.pravatar.cc/96?img=59',
];

const RAW_USERS = [
  ["01", "Bashar Islam",   "Bashar@gmail.com",           "(+44) 201234", "Rangpur",   "2025-03-12 09:30 AM"],
  ["02", "Amina Rahman",   "amina.rahman@example.com",   "777-555",      "Dhaka",     "2025-04-15 11:00 AM"],
  ["03", "Karim Hossain",  "karim.h@example.com",        "666-444",      "Chittagong","2025-05-20 02:15 PM"],
  ["04", "Sadia Akter",    "sadiaakter@mail.com",        "888-123",      "Sylhet",    "2025-06-10 10:00 AM"],
  ["05", "Tariq Mahmud",   "tariq.mahmud@mail.com",      "555-678",      "Khulna",    "2025-07-05 03:30 PM"],
  ["06", "Nusrat Jahan",   "nusrat.j@example.com",       "444-321",      "Rajshahi",  "2025-08-22 01:45 PM"],
  ["07", "Imran Khan",     "imran.khan@mail.com",        "333-999",      "Barisal",   "2025-09-18 04:00 PM"],
  ["08", "Rashed Karim",   "rashed.k@example.com",       "222-456",      "Mymensingh","2025-10-03 09:00 AM"],
  ["09", "Nadia Islam",    "nadia.i@example.com",        "111-789",      "Dhaka",     "2025-10-14 11:30 AM"],
  ["10", "Farhan Ahmed",   "farhan.a@example.com",       "999-012",      "Comilla",   "2025-11-01 02:00 PM"],
  ["11", "Tasnim Haque",   "tasnim.h@example.com",       "888-345",      "Jessore",   "2025-11-18 10:45 AM"],
  ["12", "Omar Faruq",     "omar.f@example.com",         "777-678",      "Rangpur",   "2025-12-05 03:15 PM"],
  ["13", "Sumaiya Begum",  "sumaiya.b@example.com",      "666-901",      "Sylhet",    "2025-12-20 01:00 PM"],
  ["14", "Mahfuz Alam",    "mahfuz.a@example.com",       "555-234",      "Dhaka",     "2026-01-08 09:30 AM"],
  ["15", "Rubina Khatun",  "rubina.k@example.com",       "444-567",      "Chittagong","2026-01-22 11:15 AM"],
  ["16", "Jubayer Hossain","jubayer.h@example.com",      "333-890",      "Khulna",    "2026-02-10 02:45 PM"],
  ["17", "Lamia Sultana",  "lamia.s@example.com",        "222-123",      "Rajshahi",  "2026-02-25 10:00 AM"],
  ["18", "Sabbir Rahman",  "sabbir.r@example.com",       "111-456",      "Barisal",   "2026-03-12 04:30 PM"],
  ["19", "Farzana Islam",  "farzana.i@example.com",      "999-789",      "Mymensingh","2026-03-28 09:15 AM"],
  ["20", "Raihan Uddin",   "raihan.u@example.com",       "888-012",      "Comilla",   "2026-04-15 01:30 PM"],
  ["21", "Mim Akhter",     "mim.a@example.com",          "777-345",      "Dhaka",     "2026-04-28 10:30 AM"],
  ["22", "Nasir Hossain",  "nasir.h@example.com",        "666-678",      "Jessore",   "2026-05-10 03:00 PM"],
  ["23", "Roksana Begum",  "roksana.b@example.com",      "555-901",      "Sylhet",    "2026-05-22 11:45 AM"],
  ["24", "Shakil Ahmed",   "shakil.a@example.com",       "444-234",      "Rangpur",   "2026-06-05 02:15 PM"],
  ["25", "Tania Rahman",   "tania.r@example.com",        "333-567",      "Dhaka",     "2026-06-18 09:00 AM"],
];

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/smart_meal_db?schema=public&sslmode=disable';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding initial database data...');

  const passwordHash = await argon2.hash('AdminPassword123!');

  // 1. Seed Super Admin users
  const adminEmails = [
    { email: 'admin@sizzl.com', name: 'Bashar Islam' },
    { email: 'admin@smartmeal.com', name: 'Super Admin' },
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
          name: adminData.name,
          role: Role.SUPER_ADMIN,
          isEmailVerified: true,
          phoneNumber: '(+44) 201234',
          address: 'Rangpur',
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
          name: adminData.name,
        },
      });
      console.log(`Updated Super Admin credentials: ${adminData.email}`);
    }
  }

  // 2. Seed all 25 platform users
  const userPasswordHash = await argon2.hash('UserPassword123!');
  const blockedList = ["03", "05"];

  for (let i = 0; i < RAW_USERS.length; i++) {
    const [no, fullName, emailRaw, phone, address, dateStr] = RAW_USERS[i];
    const email = emailRaw.trim().toLowerCase();
    const isBlocked = blockedList.includes(no);

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    let dbUser = existing;
    if (!existing) {
      dbUser = await prisma.user.create({
        data: {
          email,
          passwordHash: userPasswordHash,
          name: fullName,
          phoneNumber: phone,
          address,
          role: Role.USER,
          isEmailVerified: true,
          isBlocked,
          avatarUrl: AVATARS[i % AVATARS.length],
          weeklyBudget: 120 + i * 10,
          createdAt: new Date(dateStr.split(' ')[0]),
        },
      });
    } else {
      dbUser = await prisma.user.update({
        where: { email },
        data: {
          name: fullName,
          phoneNumber: phone,
          address,
          isBlocked,
          avatarUrl: AVATARS[i % AVATARS.length],
        },
      });
    }

    if (dbUser) {
      const planName = i % 2 === 0 ? 'Annual Plan' : 'Monthly Premium';
      const existingSub = await prisma.subscription.findFirst({
        where: { userId: dbUser.id },
      });
      if (!existingSub) {
        await prisma.subscription.create({
          data: {
            userId: dbUser.id,
            planName,
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2027-01-01'),
          },
        });
      }

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
      cuisine: 'British',
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
      cuisine: 'Asian',
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
      mealType: 'Lunch',
      cuisine: 'Mediterranean',
      prepTimeMinutes: 28,
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
      title: 'Overnight Oats',
      mealType: 'Breakfast',
      cuisine: 'American',
      prepTimeMinutes: 5,
      servings: 2,
      estimatedCost: 2.0,
      dietaryTags: ['VEGAN', 'GLUTEN_FREE'],
      instructions: ['Mix oats with milk and honey', 'Refrigerate overnight', 'Top with fruits'],
      ingredients: [
        { name: 'Rolled oats', category: 'Pantry Staples', quantity: '1 cup' },
        { name: 'Almond milk', category: 'Dairy', quantity: '1 cup' },
      ],
    },
    {
      title: 'Veggie Curry',
      mealType: 'Dinner',
      cuisine: 'Indian',
      prepTimeMinutes: 25,
      servings: 4,
      estimatedCost: 5.0,
      dietaryTags: ['VEGETARIAN', 'HALAL'],
      instructions: ['Sauté onions and spices', 'Add chickpeas and coconut milk', 'Simmer for 20 mins'],
      ingredients: [
        { name: 'Chickpeas', category: 'Pantry Staples', quantity: '1 can' },
        { name: 'Coconut milk', category: 'Pantry Staples', quantity: '1 can' },
      ],
    },
    {
      title: 'Beef Chili Jackets',
      mealType: 'Dinner',
      cuisine: 'British',
      prepTimeMinutes: 50,
      servings: 4,
      estimatedCost: 7.0,
      dietaryTags: ['HIGH_PROTEIN'],
      instructions: ['Bake potatoes', 'Simmer minced beef with chilli', 'Top with cheese'],
      ingredients: [
        { name: 'Beef mince', category: 'Meat & Fish', quantity: '500g' },
        { name: 'Potatoes', category: 'Produce', quantity: '4 large' },
      ],
    },
    {
      title: 'Greek Salad Jars',
      mealType: 'Lunch',
      cuisine: 'Mediterranean',
      prepTimeMinutes: 15,
      servings: 4,
      estimatedCost: 5.8,
      dietaryTags: ['VEGETARIAN', 'GLUTEN_FREE'],
      instructions: ['Layer dressing, cucumbers, tomatoes, and feta into jars'],
      ingredients: [
        { name: 'Cucumbers', category: 'Produce', quantity: '2 pcs' },
        { name: 'Feta cheese', category: 'Dairy', quantity: '150g' },
      ],
    },
    {
      title: 'Pesto Chicken Pasta',
      mealType: 'Dinner',
      cuisine: 'Italian',
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 7.0,
      dietaryTags: ['HIGH_PROTEIN'],
      instructions: ['Boil pasta', 'Sear sliced chicken', 'Stir in basil pesto'],
      ingredients: [
        { name: 'Penne pasta', category: 'Pantry Staples', quantity: '400g' },
        { name: 'Chicken breast', category: 'Meat & Fish', quantity: '400g' },
        { name: 'Pesto', category: 'Pantry Staples', quantity: '1 jar' },
      ],
    },
    {
      title: 'Shakshuka',
      mealType: 'Breakfast',
      cuisine: 'Middle Eastern',
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 4.0,
      dietaryTags: ['VEGETARIAN'],
      instructions: ['Simmer spiced tomato sauce', 'Crack eggs into sauce', 'Cover until poached'],
      ingredients: [
        { name: 'Eggs', category: 'Dairy', quantity: '4 pcs' },
        { name: 'Canned tomatoes', category: 'Pantry Staples', quantity: '1 can' },
      ],
    },
    {
      title: 'Falafel Pittas',
      mealType: 'Lunch',
      cuisine: 'Middle Eastern',
      prepTimeMinutes: 15,
      servings: 4,
      estimatedCost: 5.0,
      dietaryTags: ['VEGETARIAN', 'HALAL'],
      instructions: ['Warm pitta breads', 'Fill with crispy falafels, salad, and tahini'],
      ingredients: [
        { name: 'Falafels', category: 'Produce', quantity: '12 pcs' },
        { name: 'Pitta bread', category: 'Bakery', quantity: '4 pcs' },
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

  console.log('Database seeded successfully with all 25 users, meals, plans, and settings!');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Error during seeding:', e);
  process.exit(1);
});

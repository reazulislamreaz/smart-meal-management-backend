import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as argon2 from "argon2";

const AVATARS = [
  "https://i.pravatar.cc/96?img=12",
  "https://i.pravatar.cc/96?img=32",
  "https://i.pravatar.cc/96?img=47",
  "https://i.pravatar.cc/96?img=5",
  "https://i.pravatar.cc/96?img=15",
  "https://i.pravatar.cc/96?img=11",
  "https://i.pravatar.cc/96?img=59",
];

const RAW_USERS = [
  [
    "01",
    "Bashar Islam",
    "Bashar@gmail.com",
    "(+44) 201234",
    "Rangpur",
    "2025-03-12 09:30 AM",
  ],
  [
    "02",
    "Amina Rahman",
    "amina.rahman@example.com",
    "777-555",
    "Dhaka",
    "2025-04-15 11:00 AM",
  ],
  [
    "03",
    "Karim Hossain",
    "karim.h@example.com",
    "666-444",
    "Chittagong",
    "2025-05-20 02:15 PM",
  ],
  [
    "04",
    "Sadia Akter",
    "sadiaakter@mail.com",
    "888-123",
    "Sylhet",
    "2025-06-10 10:00 AM",
  ],
  [
    "05",
    "Tariq Mahmud",
    "tariq.mahmud@mail.com",
    "555-678",
    "Khulna",
    "2025-07-05 03:30 PM",
  ],
  [
    "06",
    "Nusrat Jahan",
    "nusrat.j@example.com",
    "444-321",
    "Rajshahi",
    "2025-08-22 01:45 PM",
  ],
  [
    "07",
    "Imran Khan",
    "imran.khan@mail.com",
    "333-999",
    "Barisal",
    "2025-09-18 04:00 PM",
  ],
  [
    "08",
    "Rashed Karim",
    "rashed.k@example.com",
    "222-456",
    "Mymensingh",
    "2025-10-03 09:00 AM",
  ],
  [
    "09",
    "Nadia Islam",
    "nadia.i@example.com",
    "111-789",
    "Dhaka",
    "2025-10-14 11:30 AM",
  ],
  [
    "10",
    "Farhan Ahmed",
    "farhan.a@example.com",
    "999-012",
    "Comilla",
    "2025-11-01 02:00 PM",
  ],
  [
    "11",
    "Tasnim Haque",
    "tasnim.h@example.com",
    "888-345",
    "Jessore",
    "2025-11-18 10:45 AM",
  ],
  [
    "12",
    "Omar Faruq",
    "omar.f@example.com",
    "777-678",
    "Rangpur",
    "2025-12-05 03:15 PM",
  ],
  [
    "13",
    "Sumaiya Begum",
    "sumaiya.b@example.com",
    "666-901",
    "Sylhet",
    "2025-12-20 01:00 PM",
  ],
  [
    "14",
    "Mahfuz Alam",
    "mahfuz.a@example.com",
    "555-234",
    "Dhaka",
    "2026-01-08 09:30 AM",
  ],
  [
    "15",
    "Rubina Khatun",
    "rubina.k@example.com",
    "444-567",
    "Chittagong",
    "2026-01-22 11:15 AM",
  ],
  [
    "16",
    "Jubayer Hossain",
    "jubayer.h@example.com",
    "333-890",
    "Khulna",
    "2026-02-10 02:45 PM",
  ],
  [
    "17",
    "Lamia Sultana",
    "lamia.s@example.com",
    "222-123",
    "Rajshahi",
    "2026-02-25 10:00 AM",
  ],
  [
    "18",
    "Sabbir Rahman",
    "sabbir.r@example.com",
    "111-456",
    "Barisal",
    "2026-03-12 04:30 PM",
  ],
  [
    "19",
    "Farzana Islam",
    "farzana.i@example.com",
    "999-789",
    "Mymensingh",
    "2026-03-28 09:15 AM",
  ],
  [
    "20",
    "Raihan Uddin",
    "raihan.u@example.com",
    "888-012",
    "Comilla",
    "2026-04-15 01:30 PM",
  ],
  [
    "21",
    "Mim Akhter",
    "mim.a@example.com",
    "777-345",
    "Dhaka",
    "2026-04-28 10:30 AM",
  ],
  [
    "22",
    "Nasir Hossain",
    "nasir.h@example.com",
    "666-678",
    "Jessore",
    "2026-05-10 03:00 PM",
  ],
  [
    "23",
    "Roksana Begum",
    "roksana.b@example.com",
    "555-901",
    "Sylhet",
    "2026-05-22 11:45 AM",
  ],
  [
    "24",
    "Shakil Ahmed",
    "shakil.a@example.com",
    "444-234",
    "Rangpur",
    "2026-06-05 02:15 PM",
  ],
  [
    "25",
    "Tania Rahman",
    "tania.r@example.com",
    "333-567",
    "Dhaka",
    "2026-06-18 09:00 AM",
  ],
];

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5433/smart_meal_db?schema=public&sslmode=disable";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Seeding initial database data...");

  const passwordHash = await argon2.hash("AdminPassword123!");

  // 1. Seed Super Admin users
  const adminEmails = [
    { email: "admin@sizzl.com", name: "Bashar Islam" },
    { email: "admin@smartmeal.com", name: "Super Admin" },
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
          phoneNumber: "(+44) 201234",
          address: "Rangpur",
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
  const userPasswordHash = await argon2.hash("UserPassword123!");
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
          createdAt: new Date(dateStr.split(" ")[0]),
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
      const planName = i % 2 === 0 ? "Annual Plan" : "Monthly Premium";
      const existingSub = await prisma.subscription.findFirst({
        where: { userId: dbUser.id },
      });
      if (!existingSub) {
        await prisma.subscription.create({
          data: {
            userId: dbUser.id,
            planName,
            status: "ACTIVE",
            currentPeriodEnd: new Date("2027-01-01"),
          },
        });
      }

      const taskCount = await prisma.task.count({
        where: { userId: dbUser.id },
      });
      if (taskCount === 0) {
        await prisma.task.createMany({
          data: [
            {
              userId: dbUser.id,
              title: "Grocery Pickup at Walmart",
              description: "Pick up weekly fresh produce and dairy",
              status: "COMPLETED",
            },
            {
              userId: dbUser.id,
              title: "Prep Chicken Caesar Wraps",
              description: "Marinate chicken thighs and wash lettuce",
              status: "PENDING",
            },
          ],
        });
      }
    }
  }

  // 3. Seed Subscription Pricing Plans
  const plans = [
    {
      name: "Monthly Premium",
      description:
        "Full AI meal planning, smart grocery list, and household sync billed monthly",
      price: 7.99,
      interval: "monthly",
      currency: "USD",
      features: [
        "Unlimited AI Weekly Meal Plans",
        "Smart Pantry & Expiry Tracking",
        "Automated Shopping Lists with Deductions",
        "Family Household Sharing",
        "Nutritional Macro Breakdown",
      ],
      isPopular: true,
      isActive: true,
    },
    {
      name: "Annual Plan",
      description:
        "Save 37% with our annual subscription for continuous budget and meal optimization",
      price: 59.88,
      interval: "yearly",
      currency: "USD",
      features: [
        "All Monthly Premium Features",
        "2 Months Free (Save 37%)",
        "Priority AI Generation Speed",
        "Export to PDF & Excel",
        "Dedicated 24/7 Priority Support",
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

  // 4. Seed Master Meals Catalog (Expanded to 45+ diverse recipes)
  const meals = [
    // --- BREAKFAST (15 Meals) ---
    {
      title: "Overnight Oats with Chia & Berries",
      mealType: "Breakfast",
      cuisine: "American",
      prepTimeMinutes: 5,
      servings: 2,
      estimatedCost: 2.5,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"],
      instructions: [
        "Mix rolled oats, chia seeds, and almond milk in a mason jar",
        "Refrigerate overnight for 6+ hours",
        "Top with fresh blueberries, strawberries, and maple syrup",
      ],
      ingredients: [
        { name: "Rolled oats", category: "Pantry Staples", quantity: "1 cup" },
        { name: "Chia seeds", category: "Pantry Staples", quantity: "2 tbsp" },
        { name: "Almond milk", category: "Dairy", quantity: "1.5 cups" },
        { name: "Fresh berries", category: "Produce", quantity: "100g" },
      ],
    },
    {
      title: "Mediterranean Shakshuka with Feta",
      mealType: "Breakfast",
      cuisine: "Middle Eastern",
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 4.5,
      dietaryTags: ["VEGETARIAN", "GLUTEN_FREE", "HALAL"],
      instructions: [
        "Sauté diced onions, bell peppers, garlic, cumin, and smoked paprika in olive oil",
        "Pour in crushed tomatoes and simmer until thick",
        "Create small wells in sauce and crack in whole eggs",
        "Cover skillet and poach eggs until whites are set",
        "Crumble fresh feta and chopped parsley over the top",
      ],
      ingredients: [
        { name: "Eggs", category: "Dairy", quantity: "4 pcs" },
        {
          name: "Canned crushed tomatoes",
          category: "Pantry Staples",
          quantity: "400g",
        },
        { name: "Bell pepper", category: "Produce", quantity: "1 large" },
        { name: "Feta cheese", category: "Dairy", quantity: "80g" },
        { name: "Olive oil", category: "Pantry Staples", quantity: "2 tbsp" },
      ],
    },
    {
      title: "Avocado & Poached Egg Sourdough Toast",
      mealType: "Breakfast",
      cuisine: "American",
      prepTimeMinutes: 10,
      servings: 2,
      estimatedCost: 4.0,
      dietaryTags: ["VEGETARIAN", "HIGH_PROTEIN"],
      instructions: [
        "Toast thick slices of artisan sourdough bread",
        "Mash ripe avocado with lime juice, sea salt, and red pepper flakes",
        "Poach eggs in simmering water with a drop of vinegar for 3 minutes",
        "Spread mashed avocado over toast and crown with poached egg",
      ],
      ingredients: [
        { name: "Sourdough bread", category: "Bakery", quantity: "2 slices" },
        { name: "Avocado", category: "Produce", quantity: "1 large" },
        { name: "Eggs", category: "Dairy", quantity: "2 pcs" },
        { name: "Lime", category: "Produce", quantity: "1 pc" },
      ],
    },
    {
      title: "Spinach & Goat Cheese Frittata",
      mealType: "Breakfast",
      cuisine: "Italian",
      prepTimeMinutes: 25,
      servings: 4,
      estimatedCost: 5.5,
      dietaryTags: ["VEGETARIAN", "GLUTEN_FREE", "HIGH_PROTEIN", "KETO"],
      instructions: [
        "Whisk eggs with a splash of cream, salt, and black pepper",
        "Sauté fresh baby spinach and shallots in an oven-safe skillet until wilted",
        "Pour egg mixture over greens and dot with creamy goat cheese",
        "Bake at 180°C for 18 minutes until golden and puffed",
      ],
      ingredients: [
        { name: "Eggs", category: "Dairy", quantity: "6 large" },
        { name: "Baby spinach", category: "Produce", quantity: "150g" },
        { name: "Goat cheese", category: "Dairy", quantity: "100g" },
        { name: "Shallots", category: "Produce", quantity: "2 pcs" },
      ],
    },
    {
      title: "Japanese Tamagoyaki Rice Bowl",
      mealType: "Breakfast",
      cuisine: "Japanese",
      prepTimeMinutes: 15,
      servings: 2,
      estimatedCost: 3.5,
      dietaryTags: ["VEGETARIAN", "HIGH_PROTEIN"],
      instructions: [
        "Whisk eggs with mirin, light soy sauce, and a pinch of sugar",
        "Roll thin layers of egg in a tamagoyaki pan until layered",
        "Slice rolled omelette into thick rounds",
        "Serve over steamed short-grain rice with furikake and scallions",
      ],
      ingredients: [
        { name: "Eggs", category: "Dairy", quantity: "4 pcs" },
        {
          name: "Short-grain rice",
          category: "Pantry Staples",
          quantity: "200g",
        },
        { name: "Soy sauce", category: "Pantry Staples", quantity: "1 tbsp" },
        { name: "Scallions", category: "Produce", quantity: "2 stalks" },
      ],
    },
    {
      title: "Fluffy Banana Protein Pancakes",
      mealType: "Breakfast",
      cuisine: "American",
      prepTimeMinutes: 15,
      servings: 2,
      estimatedCost: 3.0,
      dietaryTags: ["VEGETARIAN", "HIGH_PROTEIN"],
      instructions: [
        "Blend ripe banana, oats, vanilla protein powder, eggs, and baking powder",
        "Cook silver-dollar pancakes on a hot non-stick skillet for 2 mins per side",
        "Stack and serve drizzled with 100% pure maple syrup and walnuts",
      ],
      ingredients: [
        { name: "Ripe bananas", category: "Produce", quantity: "2 pcs" },
        { name: "Rolled oats", category: "Pantry Staples", quantity: "1 cup" },
        { name: "Eggs", category: "Dairy", quantity: "2 pcs" },
        { name: "Maple syrup", category: "Pantry Staples", quantity: "2 tbsp" },
      ],
    },
    {
      title: "Mexican Huevos Rancheros",
      mealType: "Breakfast",
      cuisine: "Mexican",
      prepTimeMinutes: 18,
      servings: 2,
      estimatedCost: 3.8,
      dietaryTags: ["VEGETARIAN", "GLUTEN_FREE", "HIGH_PROTEIN"],
      instructions: [
        "Warm corn tortillas in a skillet until lightly crisp",
        "Spread warm refried black beans over tortillas",
        "Fry sunny-side-up eggs and place on top",
        "Smother with warm ranchero salsa, diced avocado, and fresh cilantro",
      ],
      ingredients: [
        {
          name: "Corn tortillas",
          category: "Pantry Staples",
          quantity: "4 pcs",
        },
        { name: "Eggs", category: "Dairy", quantity: "4 pcs" },
        { name: "Black beans", category: "Pantry Staples", quantity: "1 can" },
        { name: "Salsa", category: "Pantry Staples", quantity: "150g" },
        { name: "Cilantro", category: "Produce", quantity: "1 bunch" },
      ],
    },
    {
      title: "Blueberry Acai Smoothie Bowl",
      mealType: "Breakfast",
      cuisine: "American",
      prepTimeMinutes: 8,
      servings: 2,
      estimatedCost: 4.2,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"],
      instructions: [
        "Blend frozen acai packet, frozen blueberries, frozen banana, and oat milk until thick and creamy",
        "Scoop into bowls and top with granola, chia seeds, and coconut flakes",
      ],
      ingredients: [
        { name: "Frozen blueberries", category: "Frozen", quantity: "150g" },
        { name: "Bananas", category: "Produce", quantity: "2 pcs" },
        { name: "Oat milk", category: "Dairy", quantity: "100ml" },
        { name: "Granola", category: "Pantry Staples", quantity: "50g" },
      ],
    },
    {
      title: "Smoked Salmon & Herbed Cream Cheese Bagel",
      mealType: "Breakfast",
      cuisine: "American",
      prepTimeMinutes: 8,
      servings: 2,
      estimatedCost: 6.5,
      dietaryTags: ["PESCATARIAN", "HIGH_PROTEIN"],
      instructions: [
        "Toast sesame seed bagels",
        "Spread generous layer of chive cream cheese",
        "Top with silky smoked salmon slices, capers, thin red onion rings, and dill",
      ],
      ingredients: [
        { name: "Sesame bagels", category: "Bakery", quantity: "2 pcs" },
        { name: "Smoked salmon", category: "Meat & Fish", quantity: "120g" },
        { name: "Cream cheese", category: "Dairy", quantity: "80g" },
        { name: "Capers", category: "Pantry Staples", quantity: "1 tbsp" },
      ],
    },
    {
      title: "Turkish Menemen Scramble",
      mealType: "Breakfast",
      cuisine: "Middle Eastern",
      prepTimeMinutes: 15,
      servings: 3,
      estimatedCost: 3.5,
      dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"],
      instructions: [
        "Sauté green chili peppers, tomatoes, and garlic in butter",
        "Gently stir in whisked eggs over low heat until soft curds form",
        "Garnish with Aleppo pepper flakes and serve with crusty bread",
      ],
      ingredients: [
        { name: "Eggs", category: "Dairy", quantity: "5 pcs" },
        { name: "Tomatoes", category: "Produce", quantity: "3 ripe" },
        { name: "Green peppers", category: "Produce", quantity: "2 pcs" },
        { name: "Butter", category: "Dairy", quantity: "25g" },
      ],
    },
    {
      title: "Chia Seed Mango Coconut Parfait",
      mealType: "Breakfast",
      cuisine: "Asian",
      prepTimeMinutes: 10,
      servings: 2,
      estimatedCost: 3.2,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"],
      instructions: [
        "Steep chia seeds in coconut milk and pure vanilla extract",
        "Layer chia pudding with fresh diced sweet mango and toasted coconut shreds in glass jars",
      ],
      ingredients: [
        { name: "Chia seeds", category: "Pantry Staples", quantity: "4 tbsp" },
        { name: "Coconut milk", category: "Pantry Staples", quantity: "250ml" },
        { name: "Fresh mango", category: "Produce", quantity: "1 ripe" },
      ],
    },
    {
      title: "Breakfast Breakfast Burrito with Turkey Chorizo",
      mealType: "Breakfast",
      cuisine: "Mexican",
      prepTimeMinutes: 20,
      servings: 2,
      estimatedCost: 4.8,
      dietaryTags: ["HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Brown spiced turkey mince with taco seasoning",
        "Scramble eggs with diced green peppers",
        "Wrap in large warm flour tortillas with cheddar cheese and salsa",
      ],
      ingredients: [
        {
          name: "Large flour tortillas",
          category: "Bakery",
          quantity: "2 pcs",
        },
        { name: "Turkey mince", category: "Meat & Fish", quantity: "200g" },
        { name: "Eggs", category: "Dairy", quantity: "3 pcs" },
        { name: "Cheddar cheese", category: "Dairy", quantity: "60g" },
      ],
    },
    {
      title: "Greek Yogurt Crunch with Honey & Walnuts",
      mealType: "Breakfast",
      cuisine: "Greek",
      prepTimeMinutes: 5,
      servings: 2,
      estimatedCost: 2.8,
      dietaryTags: ["VEGETARIAN", "GLUTEN_FREE", "HIGH_PROTEIN"],
      instructions: [
        "Spoon thick authentic Greek yogurt into bowls",
        "Top with toasted walnuts and pomegranate arils",
        "Drizzle generously with wildflower honey",
      ],
      ingredients: [
        { name: "Greek yogurt", category: "Dairy", quantity: "300g" },
        { name: "Walnuts", category: "Pantry Staples", quantity: "50g" },
        { name: "Honey", category: "Pantry Staples", quantity: "2 tbsp" },
      ],
    },
    {
      title: "Classic French Herb & Cheese Omelette",
      mealType: "Breakfast",
      cuisine: "French",
      prepTimeMinutes: 10,
      servings: 2,
      estimatedCost: 3.2,
      dietaryTags: ["VEGETARIAN", "GLUTEN_FREE", "HIGH_PROTEIN", "KETO"],
      instructions: [
        "Beat eggs with finely chopped chives, tarragon, and parsley",
        "Cook in foaming butter over medium-low heat until creamy and set",
        "Roll into a neat cylinder and sprinkle with sea salt",
      ],
      ingredients: [
        { name: "Eggs", category: "Dairy", quantity: "4 large" },
        {
          name: "Fresh herbs (chives, parsley)",
          category: "Produce",
          quantity: "2 tbsp",
        },
        { name: "Gruyere cheese", category: "Dairy", quantity: "40g" },
        { name: "Butter", category: "Dairy", quantity: "20g" },
      ],
    },
    {
      title: "Crispy Halloumi & Spiced Tomato Breakfast Pitta",
      mealType: "Breakfast",
      cuisine: "Middle Eastern",
      prepTimeMinutes: 12,
      servings: 2,
      estimatedCost: 4.5,
      dietaryTags: ["VEGETARIAN", "HALAL"],
      instructions: [
        "Pan-sear halloumi slices in olive oil until deeply golden",
        "Stuff warm whole-wheat pittas with zaatar tomatoes, cucumbers, and warm halloumi",
      ],
      ingredients: [
        { name: "Halloumi cheese", category: "Dairy", quantity: "180g" },
        { name: "Whole wheat pitta", category: "Bakery", quantity: "2 pcs" },
        { name: "Cherry tomatoes", category: "Produce", quantity: "100g" },
        { name: "Zaatar spice", category: "Pantry Staples", quantity: "1 tsp" },
      ],
    },

    // --- LUNCH (15 Meals) ---
    {
      title: "Halloumi & Warm Spiced Couscous Salad",
      mealType: "Lunch",
      cuisine: "Mediterranean",
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 6.0,
      dietaryTags: ["VEGETARIAN"],
      instructions: [
        "Sear halloumi slices until golden brown",
        "Steep couscous in hot vegetable broth with lemon zest and cumin",
        "Toss with diced roasted peppers, mint, and toasted pine nuts",
      ],
      ingredients: [
        { name: "Halloumi", category: "Dairy", quantity: "250g" },
        { name: "Couscous", category: "Pantry Staples", quantity: "200g" },
        {
          name: "Roasted bell peppers",
          category: "Pantry Staples",
          quantity: "1 jar",
        },
        { name: "Fresh mint", category: "Produce", quantity: "1 bunch" },
      ],
    },
    {
      title: "Crispy Falafel & Tahini Pitta Pockets",
      mealType: "Lunch",
      cuisine: "Middle Eastern",
      prepTimeMinutes: 15,
      servings: 4,
      estimatedCost: 5.0,
      dietaryTags: ["VEGAN", "VEGETARIAN", "HALAL", "DAIRY_FREE"],
      instructions: [
        "Bake or air-fry falafel patties until crispy",
        "Warm pitta breads and slice open",
        "Fill with pickled turnips, shredded cabbage, cucumber, and drench in garlic tahini sauce",
      ],
      ingredients: [
        { name: "Falafels", category: "Produce", quantity: "12 pcs" },
        { name: "Pitta bread", category: "Bakery", quantity: "4 pcs" },
        { name: "Tahini", category: "Pantry Staples", quantity: "4 tbsp" },
        { name: "Cucumbers", category: "Produce", quantity: "2 pcs" },
      ],
    },
    {
      title: "Layered Greek Salad Mason Jars",
      mealType: "Lunch",
      cuisine: "Greek",
      prepTimeMinutes: 15,
      servings: 4,
      estimatedCost: 5.8,
      dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"],
      instructions: [
        "Whisk red wine vinegar and extra virgin olive oil vinaigrette",
        "Layer jars: dressing, kalamata olives, cucumber chunks, cherry tomatoes, and crumbled feta cheese",
        "Invert onto plate when ready to eat",
      ],
      ingredients: [
        { name: "Cucumbers", category: "Produce", quantity: "2 pcs" },
        { name: "Cherry tomatoes", category: "Produce", quantity: "250g" },
        { name: "Feta cheese", category: "Dairy", quantity: "150g" },
        {
          name: "Kalamata olives",
          category: "Pantry Staples",
          quantity: "100g",
        },
      ],
    },
    {
      title: "Sesame Ginger Soba Noodle Bowl",
      mealType: "Lunch",
      cuisine: "Japanese",
      prepTimeMinutes: 18,
      servings: 3,
      estimatedCost: 4.5,
      dietaryTags: ["VEGAN", "DAIRY_FREE"],
      instructions: [
        "Boil buckwheat soba noodles for 4 minutes and rinse in ice cold water",
        "Toss with sesame-ginger-tamari dressing, edamame beans, shredded carrots, and cucumber ribbons",
        "Sprinkle with toasted sesame seeds and nori",
      ],
      ingredients: [
        {
          name: "Buckwheat soba noodles",
          category: "Pantry Staples",
          quantity: "200g",
        },
        { name: "Shelled edamame", category: "Frozen", quantity: "150g" },
        { name: "Carrots", category: "Produce", quantity: "2 pcs" },
        { name: "Sesame oil", category: "Pantry Staples", quantity: "2 tbsp" },
      ],
    },
    {
      title: "Chipotle Chicken Burrito Bowl",
      mealType: "Lunch",
      cuisine: "Mexican",
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 6.8,
      dietaryTags: ["HIGH_PROTEIN", "GLUTEN_FREE", "HALAL"],
      instructions: [
        "Season and grill chicken breast in chipotle marinade",
        "Assemble bowls with cilantro lime brown rice, seasoned black beans, sweet corn, salsa, and sliced grilled chicken",
      ],
      ingredients: [
        { name: "Chicken breast", category: "Meat & Fish", quantity: "450g" },
        { name: "Brown rice", category: "Pantry Staples", quantity: "250g" },
        { name: "Black beans", category: "Pantry Staples", quantity: "1 can" },
        { name: "Sweet corn", category: "Pantry Staples", quantity: "1 can" },
        {
          name: "Chipotle paste",
          category: "Pantry Staples",
          quantity: "2 tbsp",
        },
      ],
    },
    {
      title: "Vietnamese Lemongrass Tofu Vermicelli Salad",
      mealType: "Lunch",
      cuisine: "Asian",
      prepTimeMinutes: 22,
      servings: 3,
      estimatedCost: 4.8,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"],
      instructions: [
        "Pan-sear pressed firm tofu cubes coated in minced lemongrass, garlic, and tamari",
        "Arrange over rice vermicelli noodles with fresh mint, cilantro, bean sprouts, and crushed peanuts",
        "Drizzle with sweet-tangy lime dressing",
      ],
      ingredients: [
        { name: "Firm tofu", category: "Produce", quantity: "350g" },
        {
          name: "Rice vermicelli",
          category: "Pantry Staples",
          quantity: "200g",
        },
        { name: "Lemongrass paste", category: "Produce", quantity: "2 tbsp" },
        { name: "Peanuts", category: "Pantry Staples", quantity: "40g" },
      ],
    },
    {
      title: "Tuna & White Bean Mediterranean Salad",
      mealType: "Lunch",
      cuisine: "Italian",
      prepTimeMinutes: 10,
      servings: 2,
      estimatedCost: 3.8,
      dietaryTags: ["PESCATARIAN", "GLUTEN_FREE", "HIGH_PROTEIN", "DAIRY_FREE"],
      instructions: [
        "Drain cannellini beans and high quality albacore tuna in olive oil",
        "Toss with finely diced red onions, capers, flat-leaf parsley, lemon juice, and extra virgin olive oil",
        "Season with cracked black pepper",
      ],
      ingredients: [
        {
          name: "Canned tuna in olive oil",
          category: "Pantry Staples",
          quantity: "2 cans",
        },
        {
          name: "Cannellini beans",
          category: "Pantry Staples",
          quantity: "1 can",
        },
        { name: "Red onion", category: "Produce", quantity: "0.5 pc" },
        { name: "Lemon", category: "Produce", quantity: "1 pc" },
      ],
    },
    {
      title: "Moroccan Spiced Chickpea & Quinoa Bowl",
      mealType: "Lunch",
      cuisine: "Middle Eastern",
      prepTimeMinutes: 20,
      servings: 3,
      estimatedCost: 4.2,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE", "HIGH_PROTEIN"],
      instructions: [
        "Roast chickpeas tossed in ras el hanout, olive oil, and sea salt at 200°C for 15 mins",
        "Serve over fluffy cooked quinoa with grated beetroot, baby spinach, and lemon-tahini dressing",
      ],
      ingredients: [
        { name: "Chickpeas", category: "Pantry Staples", quantity: "1 can" },
        { name: "Quinoa", category: "Pantry Staples", quantity: "180g" },
        { name: "Baby spinach", category: "Produce", quantity: "100g" },
        {
          name: "Ras el hanout spice",
          category: "Pantry Staples",
          quantity: "1 tbsp",
        },
      ],
    },
    {
      title: "Grilled Lemon Herb Chicken Caesar Wrap",
      mealType: "Lunch",
      cuisine: "American",
      prepTimeMinutes: 15,
      servings: 2,
      estimatedCost: 5.2,
      dietaryTags: ["HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Slice grilled lemon herb chicken cutlets",
        "Toss crisp romaine lettuce with creamy Caesar dressing and shaved parmesan",
        "Wrap snugly in large spinach or flour tortillas",
      ],
      ingredients: [
        { name: "Chicken breast", category: "Meat & Fish", quantity: "300g" },
        { name: "Romaine lettuce", category: "Produce", quantity: "1 head" },
        { name: "Tortilla wraps", category: "Bakery", quantity: "2 pcs" },
        { name: "Parmesan cheese", category: "Dairy", quantity: "40g" },
      ],
    },
    {
      title: "Caprese Pesto Chicken Ciabatta",
      mealType: "Lunch",
      cuisine: "Italian",
      prepTimeMinutes: 12,
      servings: 2,
      estimatedCost: 5.5,
      dietaryTags: ["HIGH_PROTEIN"],
      instructions: [
        "Toast artisan ciabatta rolls",
        "Layer with basil pesto, warm roasted chicken strips, ripe beefsteak tomatoes, fresh mozzarella, and balsamic glaze",
      ],
      ingredients: [
        { name: "Ciabatta rolls", category: "Bakery", quantity: "2 pcs" },
        {
          name: "Cooked chicken strips",
          category: "Meat & Fish",
          quantity: "200g",
        },
        { name: "Fresh mozzarella", category: "Dairy", quantity: "125g" },
        { name: "Basil pesto", category: "Pantry Staples", quantity: "2 tbsp" },
      ],
    },
    {
      title: "Spicy Thai Green Papaya & Peanut Salad",
      mealType: "Lunch",
      cuisine: "Thai",
      prepTimeMinutes: 15,
      servings: 2,
      estimatedCost: 4.0,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"],
      instructions: [
        "Shred green papaya or chayote squash and carrots into fine ribbons",
        "Pound garlic, bird-eye chili, lime juice, and coconut sugar in a mortar",
        "Toss together with crushed roasted peanuts and fresh coriander",
      ],
      ingredients: [
        {
          name: "Green papaya or carrots",
          category: "Produce",
          quantity: "300g",
        },
        { name: "Lime", category: "Produce", quantity: "2 pcs" },
        {
          name: "Roasted peanuts",
          category: "Pantry Staples",
          quantity: "50g",
        },
        { name: "Garlic cloves", category: "Produce", quantity: "2 pcs" },
      ],
    },
    {
      title: "Hearty Lentil & Vegetable Minestrone Soup",
      mealType: "Lunch",
      cuisine: "Italian",
      prepTimeMinutes: 30,
      servings: 4,
      estimatedCost: 4.5,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"],
      instructions: [
        "Sauté diced mirepoix (onion, carrot, celery) and garlic in olive oil",
        "Add brown lentils, diced tomatoes, vegetable broth, and zucchini",
        "Simmer until lentils are tender, finish with chopped kale",
      ],
      ingredients: [
        { name: "Brown lentils", category: "Pantry Staples", quantity: "150g" },
        { name: "Carrots", category: "Produce", quantity: "2 pcs" },
        { name: "Celery stalks", category: "Produce", quantity: "2 pcs" },
        {
          name: "Canned diced tomatoes",
          category: "Pantry Staples",
          quantity: "1 can",
        },
      ],
    },
    {
      title: "Smoked Turkey, Avocado & Bacon Club Wrap",
      mealType: "Lunch",
      cuisine: "American",
      prepTimeMinutes: 10,
      servings: 2,
      estimatedCost: 5.8,
      dietaryTags: ["HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Layer sliced smoked turkey breast, crispy turkey bacon, sliced avocado, lettuce, and tomato in large flatbread wraps with Dijon mayo",
      ],
      ingredients: [
        {
          name: "Smoked turkey slices",
          category: "Meat & Fish",
          quantity: "200g",
        },
        { name: "Turkey bacon", category: "Meat & Fish", quantity: "4 strips" },
        { name: "Avocado", category: "Produce", quantity: "1 pc" },
        { name: "Flatbread wraps", category: "Bakery", quantity: "2 pcs" },
      ],
    },
    {
      title: "Korean Kimchi & Egg Fried Rice",
      mealType: "Lunch",
      cuisine: "Asian",
      prepTimeMinutes: 15,
      servings: 2,
      estimatedCost: 3.5,
      dietaryTags: ["VEGETARIAN"],
      instructions: [
        "Sauté chopped aged kimchi in sesame oil until caramelized",
        "Add day-old chilled rice and gochujang sauce, stir-fry over high heat",
        "Top each bowl with a crispy fried egg, nori strips, and toasted sesame",
      ],
      ingredients: [
        {
          name: "Cooked jasmine rice",
          category: "Pantry Staples",
          quantity: "300g",
        },
        { name: "Kimchi", category: "Produce", quantity: "150g" },
        { name: "Eggs", category: "Dairy", quantity: "2 pcs" },
        { name: "Sesame oil", category: "Pantry Staples", quantity: "1 tbsp" },
      ],
    },
    {
      title: "Warm Sweet Potato & Black Bean Bowl",
      mealType: "Lunch",
      cuisine: "Mexican",
      prepTimeMinutes: 25,
      servings: 3,
      estimatedCost: 4.0,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"],
      instructions: [
        "Roast cubed sweet potatoes with chili powder and cumin at 200°C for 20 mins",
        "Warm black beans with lime juice and garlic",
        "Assemble with pumpkin seeds, avocado, and creamy cilantro tahini dressing",
      ],
      ingredients: [
        { name: "Sweet potatoes", category: "Produce", quantity: "2 medium" },
        { name: "Black beans", category: "Pantry Staples", quantity: "1 can" },
        { name: "Pumpkin seeds", category: "Pantry Staples", quantity: "30g" },
        { name: "Cilantro", category: "Produce", quantity: "1 bunch" },
      ],
    },

    // --- DINNER (17 Meals) ---
    {
      title: "Sheet-Pan Lemon Herb Chicken & Veg Traybake",
      mealType: "Dinner",
      cuisine: "British",
      prepTimeMinutes: 25,
      servings: 4,
      estimatedCost: 7.5,
      dietaryTags: ["HIGH_PROTEIN", "GLUTEN_FREE", "HALAL"],
      instructions: [
        "Chop sweet potatoes, red onions, and bell peppers into bite-sized chunks",
        "Toss vegetables and chicken thighs with olive oil, rosemary, oregano, garlic, and lemon slices",
        "Roast at 200°C for 35 minutes until chicken skin is crisp and vegetables are caramelized",
      ],
      ingredients: [
        { name: "Chicken thighs", category: "Meat & Fish", quantity: "600g" },
        { name: "Sweet potatoes", category: "Produce", quantity: "2 medium" },
        { name: "Bell peppers", category: "Produce", quantity: "2 pcs" },
        { name: "Red onion", category: "Produce", quantity: "1 pc" },
      ],
    },
    {
      title: "Teriyaki Glazed Salmon & Steamed Jasmine Rice",
      mealType: "Dinner",
      cuisine: "Japanese",
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 8.5,
      dietaryTags: ["PESCATARIAN", "HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Sear seasoned salmon fillets skin-down until crisp, flip and glaze with homemade teriyaki reduction",
        "Steam fragrant jasmine rice",
        "Steam tenderstem broccoli",
        "Assemble bowls garnished with sesame seeds and sliced scallions",
      ],
      ingredients: [
        {
          name: "Salmon fillets",
          category: "Meat & Fish",
          quantity: "4 fillets",
        },
        { name: "Jasmine rice", category: "Pantry Staples", quantity: "300g" },
        { name: "Tenderstem broccoli", category: "Produce", quantity: "200g" },
        {
          name: "Teriyaki sauce",
          category: "Pantry Staples",
          quantity: "4 tbsp",
        },
      ],
    },
    {
      title: "Creamy Coconut Chickpea & Spinach Curry",
      mealType: "Dinner",
      cuisine: "Indian",
      prepTimeMinutes: 25,
      servings: 4,
      estimatedCost: 5.2,
      dietaryTags: ["VEGAN", "VEGETARIAN", "GLUTEN_FREE", "HALAL"],
      instructions: [
        "Sauté diced onions, ginger, and garlic in oil with garam masala, turmeric, and cumin seeds",
        "Add chickpeas, crushed tomatoes, and coconut milk; simmer for 20 minutes",
        "Fold in fresh baby spinach until wilted and serve with basmati rice",
      ],
      ingredients: [
        { name: "Chickpeas", category: "Pantry Staples", quantity: "2 cans" },
        { name: "Coconut milk", category: "Pantry Staples", quantity: "1 can" },
        { name: "Baby spinach", category: "Produce", quantity: "150g" },
        { name: "Basmati rice", category: "Pantry Staples", quantity: "300g" },
      ],
    },
    {
      title: "Classic Beef Chili with Crispy Jacket Potatoes",
      mealType: "Dinner",
      cuisine: "British",
      prepTimeMinutes: 45,
      servings: 4,
      estimatedCost: 7.2,
      dietaryTags: ["HIGH_PROTEIN", "GLUTEN_FREE"],
      instructions: [
        "Prick potatoes and bake at 200°C for 50 mins until skins are crispy",
        "Brown lean minced beef with onions, garlic, smoked paprika, kidney beans, and chopped tomatoes",
        "Simmer chili for 30 minutes and ladle generously into split jacket potatoes with sour cream and cheddar",
      ],
      ingredients: [
        { name: "Lean minced beef", category: "Meat & Fish", quantity: "500g" },
        { name: "Baking potatoes", category: "Produce", quantity: "4 large" },
        { name: "Kidney beans", category: "Pantry Staples", quantity: "1 can" },
        {
          name: "Canned chopped tomatoes",
          category: "Pantry Staples",
          quantity: "1 can",
        },
      ],
    },
    {
      title: "Creamy Tuscan Garlic & Sun-Dried Tomato Salmon",
      mealType: "Dinner",
      cuisine: "Italian",
      prepTimeMinutes: 25,
      servings: 4,
      estimatedCost: 9.0,
      dietaryTags: ["PESCATARIAN", "HIGH_PROTEIN", "GLUTEN_FREE", "KETO"],
      instructions: [
        "Pan-sear salmon fillets in olive oil until golden; set aside",
        "In same skillet, sauté minced garlic, sun-dried tomatoes, and baby spinach in cream and vegetable broth",
        "Simmer until sauce thickens, return salmon to spoon rich sauce over top",
      ],
      ingredients: [
        {
          name: "Salmon fillets",
          category: "Meat & Fish",
          quantity: "4 fillets",
        },
        {
          name: "Sun-dried tomatoes",
          category: "Pantry Staples",
          quantity: "80g",
        },
        { name: "Heavy cream", category: "Dairy", quantity: "150ml" },
        { name: "Baby spinach", category: "Produce", quantity: "100g" },
      ],
    },
    {
      title: "Thai Green Vegetable & Tofu Coconut Curry",
      mealType: "Dinner",
      cuisine: "Thai",
      prepTimeMinutes: 22,
      servings: 4,
      estimatedCost: 5.8,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "HALAL", "DAIRY_FREE"],
      instructions: [
        "Fry authentic green curry paste in thick coconut cream until aromatic oil separates",
        "Add pressed tofu cubes, bamboo shoots, green beans, and bell peppers",
        "Simmer in coconut milk and finish with fresh Thai basil leaves and lime juice",
      ],
      ingredients: [
        { name: "Firm tofu", category: "Produce", quantity: "400g" },
        { name: "Coconut milk", category: "Pantry Staples", quantity: "1 can" },
        {
          name: "Green curry paste",
          category: "Pantry Staples",
          quantity: "3 tbsp",
        },
        { name: "Green beans", category: "Produce", quantity: "150g" },
        { name: "Thai basil", category: "Produce", quantity: "1 bunch" },
      ],
    },
    {
      title: "Moroccan Slow-Simmered Vegetable & Chickpea Tagine",
      mealType: "Dinner",
      cuisine: "Middle Eastern",
      prepTimeMinutes: 35,
      servings: 4,
      estimatedCost: 5.0,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "HALAL", "DAIRY_FREE"],
      instructions: [
        "Sauté diced butternut squash, carrots, and onions with ginger, cinnamon, and cumin",
        "Add chickpeas, vegetable stock, and dried apricots",
        "Simmer gently until squash is meltingly tender; serve over saffron couscous",
      ],
      ingredients: [
        { name: "Butternut squash", category: "Produce", quantity: "400g" },
        { name: "Chickpeas", category: "Pantry Staples", quantity: "1 can" },
        { name: "Dried apricots", category: "Pantry Staples", quantity: "60g" },
        { name: "Carrots", category: "Produce", quantity: "2 pcs" },
      ],
    },
    {
      title: "Pesto Chicken Penne with Roasted Cherry Tomatoes",
      mealType: "Dinner",
      cuisine: "Italian",
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 7.0,
      dietaryTags: ["HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Boil bronze-cut penne pasta in salted water until al dente",
        "Sear diced seasoned chicken breast until golden",
        "Blister cherry tomatoes in olive oil",
        "Toss pasta, chicken, and tomatoes with basil pesto and shaved parmesan cheese",
      ],
      ingredients: [
        { name: "Penne pasta", category: "Pantry Staples", quantity: "400g" },
        { name: "Chicken breast", category: "Meat & Fish", quantity: "400g" },
        { name: "Basil pesto", category: "Pantry Staples", quantity: "1 jar" },
        { name: "Cherry tomatoes", category: "Produce", quantity: "200g" },
      ],
    },
    {
      title: "Korean Beef & Vegetable Bibimbap Bowls",
      mealType: "Dinner",
      cuisine: "Asian",
      prepTimeMinutes: 30,
      servings: 4,
      estimatedCost: 7.8,
      dietaryTags: ["HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Marinate lean ground beef in garlic, soy sauce, and sesame oil",
        "Lightly sauté individual mounds of carrots, zucchini, bean sprouts, and spinach",
        "Arrange warm rice in bowls, topped with seasoned beef, rainbow vegetables, and a fried egg",
        "Serve with spicy sweet gochujang bibimbap sauce",
      ],
      ingredients: [
        { name: "Lean minced beef", category: "Meat & Fish", quantity: "400g" },
        {
          name: "Short-grain rice",
          category: "Pantry Staples",
          quantity: "350g",
        },
        { name: "Zucchini", category: "Produce", quantity: "1 pc" },
        {
          name: "Gochujang paste",
          category: "Pantry Staples",
          quantity: "3 tbsp",
        },
        { name: "Eggs", category: "Dairy", quantity: "4 pcs" },
      ],
    },
    {
      title: "Sizzling Mexican Chicken Fajita Skillet",
      mealType: "Dinner",
      cuisine: "Mexican",
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 6.5,
      dietaryTags: ["HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Slice chicken breasts and tri-color bell peppers into strips",
        "Toss with fajita spices, lime juice, and olive oil",
        "Sear in a smoking hot cast-iron skillet for 8-10 mins until charred at edges",
        "Serve with warm flour tortillas, guacamole, and salsa",
      ],
      ingredients: [
        { name: "Chicken breast", category: "Meat & Fish", quantity: "500g" },
        {
          name: "Tri-color bell peppers",
          category: "Produce",
          quantity: "3 pcs",
        },
        { name: "Red onion", category: "Produce", quantity: "1 large" },
        { name: "Flour tortillas", category: "Bakery", quantity: "8 pcs" },
      ],
    },
    {
      title: "Red Lentil Dahl with Turmeric Fragrant Rice",
      mealType: "Dinner",
      cuisine: "Indian",
      prepTimeMinutes: 25,
      servings: 4,
      estimatedCost: 4.0,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "HALAL", "DAIRY_FREE"],
      instructions: [
        "Rinse split red lentils and simmer with turmeric, water, and coconut milk until creamy",
        "Prepare tadka (tempered spices) by frying mustard seeds, cumin, garlic, and dried chili in oil",
        "Stir sizzling tadka into dahl and serve with turmeric basmati rice and warm garlic naan",
      ],
      ingredients: [
        {
          name: "Red split lentils",
          category: "Pantry Staples",
          quantity: "250g",
        },
        { name: "Coconut milk", category: "Pantry Staples", quantity: "1 can" },
        { name: "Basmati rice", category: "Pantry Staples", quantity: "300g" },
        { name: "Garlic cloves", category: "Produce", quantity: "4 pcs" },
      ],
    },
    {
      title: "Greek Lemon Herb Baked Cod & Roasted Potatoes",
      mealType: "Dinner",
      cuisine: "Greek",
      prepTimeMinutes: 30,
      servings: 4,
      estimatedCost: 8.2,
      dietaryTags: ["PESCATARIAN", "GLUTEN_FREE", "HIGH_PROTEIN", "DAIRY_FREE"],
      instructions: [
        "Toss parboiled potato wedges with oregano, lemon juice, olive oil, and garlic; roast at 200°C for 25 mins",
        "Season fresh cod loins with paprika and lemon zest, nestle among potatoes, and bake for 12 more minutes until flaky",
      ],
      ingredients: [
        { name: "Cod loins", category: "Meat & Fish", quantity: "500g" },
        { name: "Potatoes", category: "Produce", quantity: "4 medium" },
        { name: "Lemons", category: "Produce", quantity: "2 pcs" },
        {
          name: "Dried oregano",
          category: "Pantry Staples",
          quantity: "1 tbsp",
        },
      ],
    },
    {
      title: "Japanese Chicken Katsu Curry Bowls",
      mealType: "Dinner",
      cuisine: "Japanese",
      prepTimeMinutes: 35,
      servings: 4,
      estimatedCost: 7.2,
      dietaryTags: ["HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Coat chicken cutlets in flour, egg, and crunchy panko breadcrumbs; shallow fry or bake until golden",
        "Simmer carrots, onions, and potatoes in rich Japanese curry sauce",
        "Slice crispy katsu and serve over steamed rice blanketed in warm curry roux",
      ],
      ingredients: [
        { name: "Chicken breasts", category: "Meat & Fish", quantity: "450g" },
        {
          name: "Panko breadcrumbs",
          category: "Pantry Staples",
          quantity: "100g",
        },
        {
          name: "Japanese curry roux",
          category: "Pantry Staples",
          quantity: "1 pack",
        },
        {
          name: "Short-grain rice",
          category: "Pantry Staples",
          quantity: "300g",
        },
      ],
    },
    {
      title: "Creamy Garlic Butter Mushroom & Spinach Risotto",
      mealType: "Dinner",
      cuisine: "Italian",
      prepTimeMinutes: 30,
      servings: 4,
      estimatedCost: 5.8,
      dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"],
      instructions: [
        "Sauté mixed cremini and shiitake mushrooms in butter with garlic and thyme; set aside",
        "Toast arborio rice in shallot butter, slowly ladle in simmering vegetable broth while stirring",
        "Fold in sautéed mushrooms, fresh baby spinach, grated parmesan, and a dollop of mascarpone",
      ],
      ingredients: [
        { name: "Arborio rice", category: "Pantry Staples", quantity: "300g" },
        { name: "Mixed mushrooms", category: "Produce", quantity: "300g" },
        { name: "Parmesan cheese", category: "Dairy", quantity: "60g" },
        {
          name: "Vegetable stock",
          category: "Pantry Staples",
          quantity: "1 liter",
        },
      ],
    },
    {
      title: "Beef & Broccoli Stir-Fry with Sesame Noodles",
      mealType: "Dinner",
      cuisine: "Asian",
      prepTimeMinutes: 20,
      servings: 4,
      estimatedCost: 7.5,
      dietaryTags: ["HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Flash-fry thin slices of beef steak in a screaming hot wok with garlic and ginger",
        "Add broccoli florets and savory oyster-soy sauce reduction",
        "Toss with egg noodles and finish with sesame seeds",
      ],
      ingredients: [
        { name: "Beef flank steak", category: "Meat & Fish", quantity: "450g" },
        { name: "Broccoli florets", category: "Produce", quantity: "300g" },
        { name: "Egg noodles", category: "Pantry Staples", quantity: "300g" },
        { name: "Soy sauce", category: "Pantry Staples", quantity: "3 tbsp" },
      ],
    },
    {
      title: "Moroccan Lamb & Apricot Skillet Meatballs",
      mealType: "Dinner",
      cuisine: "Middle Eastern",
      prepTimeMinutes: 30,
      servings: 4,
      estimatedCost: 8.8,
      dietaryTags: ["HIGH_PROTEIN", "HALAL"],
      instructions: [
        "Mix minced lamb with chopped mint, cumin, coriander, and breadcrumbs; roll into meatballs",
        "Brown meatballs in olive oil, then simmer in rich cinnamon-spiced tomato sauce with dried apricots",
        "Garnish with toasted almonds and fresh coriander; serve with fluffy couscous",
      ],
      ingredients: [
        { name: "Minced lamb", category: "Meat & Fish", quantity: "500g" },
        {
          name: "Canned chopped tomatoes",
          category: "Pantry Staples",
          quantity: "1 can",
        },
        { name: "Dried apricots", category: "Pantry Staples", quantity: "50g" },
        { name: "Couscous", category: "Pantry Staples", quantity: "250g" },
      ],
    },
    {
      title: "Provencal Ratatouille with Crispy Polenta Triangles",
      mealType: "Dinner",
      cuisine: "French",
      prepTimeMinutes: 35,
      servings: 4,
      estimatedCost: 5.5,
      dietaryTags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"],
      instructions: [
        "Layer thinly sliced eggplant, zucchini, yellow squash, and plum tomatoes over herbed tomato coulis",
        "Drizzle with extra virgin olive oil and herbes de Provence; bake covered at 180°C for 30 mins",
        "Serve alongside pan-crisped golden polenta triangles",
      ],
      ingredients: [
        { name: "Eggplant", category: "Produce", quantity: "1 medium" },
        { name: "Zucchini", category: "Produce", quantity: "2 pcs" },
        { name: "Plum tomatoes", category: "Produce", quantity: "4 pcs" },
        { name: "Polenta", category: "Pantry Staples", quantity: "200g" },
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
          description: `Delicious homemade ${meal.title.toLowerCase()} crafted with fresh, wholesome ingredients and authentic regional spices.`,
          status: "Active",
        },
      });
    }
  }

  // 5. Seed System Settings (Taxonomy, App Config, Banners)
  const defaultSettings = [
    { key: "config_trialDays", value: "7" },
    { key: "config_defaultHousehold", value: "4" },
    { key: "config_aiModel", value: "gpt-4o-mini" },
    { key: "config_maxSuggestions", value: "5" },
    {
      key: "diet_options",
      value: JSON.stringify([
        "Vegetarian",
        "Vegan",
        "Halal",
        "Kosher",
        "Gluten-free",
        "Dairy-free",
        "Nut-free",
        "Pescatarian",
        "High-protein",
      ]),
    },
    {
      key: "cuisine_options",
      value: JSON.stringify([
        "Italian",
        "Mexican",
        "Asian",
        "Mediterranean",
        "American",
        "Indian",
        "Middle Eastern",
        "British",
        "Japanese",
      ]),
    },
    {
      key: "banner_home",
      value: "Welcome to Sizzl - Smart Meal Management & Pantry Optimizer",
    },
    {
      key: "banner_savings",
      value: "Save up to 40% on groceries with automated pantry deduction",
    },
    {
      key: "banner_mealPlan",
      value: "Personalized recipes customized to your household dietary matrix",
    },
    {
      key: "banner_pantry",
      value: "Zero Food Waste: Always know what ingredients you have in stock",
    },
    { key: "contact_email", value: "support@sizzl.com" },
    { key: "contact_phone", value: "+1 181 948 8101" },
    { key: "contact_address", value: "742 Evergreen Terrace, Springfield, OR" },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }

  console.log(
    "Database seeded successfully with all 25 users, meals, plans, and settings!",
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("Error during seeding:", e);
  process.exit(1);
});

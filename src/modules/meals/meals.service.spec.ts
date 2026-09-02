import { Test, TestingModule } from "@nestjs/testing";
import { MealsService } from "./meals.service";
import { PrismaService } from "@/database/prisma.service";
import { OpenAiService } from "../ai/openai.service";
import { NutritionService } from "./nutrition.service";

describe("MealsService Recommendations & Calorie Calculation", () => {
  let service: MealsService;
  let nutritionService: NutritionService;
  let mockPrismaService: any;
  let mockOpenAiService: any;

  const mockUser = {
    id: "user-123",
    name: "Alice",
    weeklyBudget: 140.0,
    adultsCount: 2,
    childrenCount: 1,
    dietaryRestrictions: ["VEGETARIAN"],
    cuisinePreferences: ["ITALIAN", "MEDITERRANEAN"],
    kitchenEquipment: ["Air Fryer", "Oven"],
    pantryStaples: ["Olive Oil", "Garlic"],
    mealVibes: ["High Protein", "Quick & Easy"],
    currency: "USD",
    preferredStoreType: "DISCOUNT",
  };

  const mockPantry = [
    {
      ingredientName: "Olive Oil",
      category: "Pantry Staples",
      quantity: 1,
      unit: "bottle",
    },
    {
      ingredientName: "Garlic",
      category: "Produce",
      quantity: 3,
      unit: "cloves",
    },
  ];

  const mockCatalogMeals = [
    {
      id: "meal-1",
      title: "Mediterranean Shakshuka with Feta",
      cuisine: "Mediterranean",
      mealType: "Breakfast",
      dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"],
      prepTimeMinutes: 20,
      servings: 2,
      estimatedCost: 4.5,
      calories: 420,
      ingredients: [{ name: "Eggs", quantity: "4 pcs" }, { name: "Garlic", quantity: "2 cloves" }, { name: "Olive oil", quantity: "1 tbsp" }],
    },
    {
      id: "meal-2",
      title: "Halloumi & Warm Spiced Couscous Salad",
      cuisine: "Mediterranean",
      mealType: "Lunch",
      dietaryTags: ["VEGETARIAN"],
      prepTimeMinutes: 20,
      servings: 2,
      estimatedCost: 6.0,
      calories: 0, // Uncalculated to test dynamic fallback
      ingredients: [{ name: "Halloumi", quantity: "200g" }, { name: "Couscous", quantity: "150g" }, { name: "Olive Oil", quantity: "1 tbsp" }],
    },
    {
      id: "meal-3",
      title: "Creamy Coconut Chickpea & Spinach Curry",
      cuisine: "Indian",
      mealType: "Dinner",
      dietaryTags: ["VEGETARIAN", "VEGAN", "GLUTEN_FREE"],
      prepTimeMinutes: 25,
      servings: 4,
      estimatedCost: 5.2,
      calories: 540,
      ingredients: [{ name: "Chickpeas", quantity: "1 can" }, { name: "Coconut milk", quantity: "1 can" }, { name: "Spinach", quantity: "150g" }],
    },
    {
      id: "meal-4",
      title: "Beef Chili Jackets",
      cuisine: "British",
      mealType: "Dinner",
      dietaryTags: ["HIGH_PROTEIN"],
      prepTimeMinutes: 45,
      servings: 4,
      estimatedCost: 7.0,
      calories: 620,
      ingredients: [{ name: "Beef mince", quantity: "500g" }, { name: "Potato", quantity: "4 pcs" }],
    },
  ];

  beforeEach(async () => {
    mockPrismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
      pantryItem: {
        findMany: jest.fn().mockResolvedValue(mockPantry),
      },
      mealPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            items: [{ meal: { id: "meal-recent-1", title: "Old Plan Meal" } }],
          },
        ]),
      },
      cookbookLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      meal: {
        findMany: jest.fn().mockResolvedValue(mockCatalogMeals),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => ({
          id: `meal-created-${Math.random()}`,
          ...args.data,
        })),
        findUnique: jest
          .fn()
          .mockImplementation(
            (args) =>
              mockCatalogMeals.find((m) => m.id === args.where.id) || null,
          ),
      },
    };

    mockOpenAiService = {
      isAvailable: jest.fn().mockReturnValue(true),
      generateFoodRecommendations: jest.fn().mockResolvedValue([
        {
          title: "AI Gourmet Stuffed Bell Peppers",
          description:
            "Quinoa and black bean stuffed peppers topped with cheese",
          mealType: "DINNER",
          prepTimeMinutes: 25,
          servings: 3,
          estimatedCost: 5.5,
          calories: 480,
          proteinGrams: 28,
          carbsGrams: 52,
          fatGrams: 16,
          cuisine: "Mexican",
          dietaryTags: ["VEGETARIAN", "HIGH_PROTEIN"],
          instructions: [
            "Mix quinoa and beans",
            "Stuff peppers",
            "Bake at 190C for 20 mins",
          ],
          ingredients: [{ name: "Bell peppers" }, { name: "Quinoa" }],
          whyRecommended:
            "High protein, uses your in-stock olive oil and garlic",
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealsService,
        NutritionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OpenAiService, useValue: mockOpenAiService },
      ],
    }).compile();

    service = module.get<MealsService>(MealsService);
    nutritionService = module.get<NutritionService>(NutritionService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
    expect(nutritionService).toBeDefined();
  });

  it("should calculate and return positive calories per adult for meals with 0 calories", () => {
    const mealWithZeroCalories = {
      id: "meal-test",
      title: "Halloumi & Warm Spiced Couscous Salad",
      mealType: "Lunch",
      servings: 2,
      calories: 0,
      ingredients: [
        { name: "Halloumi", quantity: "200g" },
        { name: "Couscous", quantity: "150g" },
        { name: "Olive Oil", quantity: "1 tbsp" },
      ],
    };

    const formatted = service.formatMealWithNutrition(mealWithZeroCalories);
    expect(formatted.calories).toBeGreaterThan(300);
    expect(formatted.caloriesPerAdult).toBe(formatted.calories);
    expect(formatted.proteinGrams).toBeGreaterThan(0);
  });

  it("should generate personalized AI food recommendations with calories when OpenAI is available", async () => {
    const result = await service.getRecommendations("user-123", {
      mealType: "DINNER",
      count: 1,
    });

    expect(mockOpenAiService.generateFoodRecommendations).toHaveBeenCalled();
    expect(result.source).toBe("AI_OPENAI");
    expect(result.count).toBe(1);
    expect(result.data[0].calories).toBe(480);
    expect(result.data[0].caloriesPerAdult).toBe(480);
    expect(result.data[0].whyRecommended).toContain("High protein");
  });

  it("should fall back gracefully to catalog recommendation engine with calories when OpenAI is unavailable", async () => {
    mockOpenAiService.isAvailable.mockReturnValue(false);

    const result = await service.getRecommendations("user-123", {
      count: 2,
    });

    expect(mockOpenAiService.generateFoodRecommendations).not.toHaveBeenCalled();
    expect(result.source).toBe("CATALOG_PERSONALIZED");
    expect(result.count).toBeGreaterThan(0);
    expect(result.data[0].calories).toBeGreaterThan(0);
    expect(result.data[0].caloriesPerAdult).toBeGreaterThan(0);
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { MealPlansService } from "./meal-plans.service";
import { PrismaService } from "@/database/prisma.service";
import { OpenAiService } from "../ai/openai.service";

describe("MealPlansService", () => {
  let service: MealPlansService;
  let mockPrismaService: any;
  let mockOpenAiService: any;
  let createdPlanItems: Array<{
    mealId: string;
    dayOfWeek: number;
    mealType: string;
  }>;

  const mockUser = {
    id: "user-123",
    name: "John",
    weeklyBudget: 150.0,
    adultsCount: 2,
    childrenCount: 1,
    plannedMealTypes: ["BREAKFAST", "LUNCH", "DINNER"],
    plannedDaysCount: 7,
    mealFrequencyBreakfast: 0,
    mealFrequencyLunch: 0,
    mealFrequencyDinner: 0,
    dietaryRestrictions: ["GLUTEN_FREE"],
    cuisinePreferences: ["MEDITERRANEAN"],
    kitchenEquipment: ["Oven", "Air Fryer"],
    pantryStaples: ["Olive Oil"],
    mealVibes: ["High-Protein"],
    preferredStoreType: "DISCOUNT",
    currency: "USD",
    country: "United States",
    city: "Chicago",
  };

  const mockPantryItems = [
    { ingredientName: "Rice", category: "Pantry", quantity: 2, unit: "kg" },
    {
      ingredientName: "Chicken Breast",
      category: "Meat",
      quantity: 500,
      unit: "g",
    },
  ];

  const buildAiMeals = (frequency: {
    breakfast: number;
    lunch: number;
    dinner: number;
  }) => {
    const meals: any[] = [];
    const pushMeals = (mealType: string, count: number) => {
      for (let index = 0; index < count; index++) {
        meals.push({
          dayOfWeek: index + 1,
          mealType,
          title: `${mealType} Meal ${index + 1}`,
          description: "Test meal",
          prepTimeMinutes: 10,
          servings: 3,
          estimatedCost: 5.0,
          cuisine: "Mediterranean",
          dietaryTags: ["GLUTEN_FREE"],
          instructions: ["Cook"],
          ingredients: [
            { name: "Rice", quantity: "1 cup", category: "Pantry" },
          ],
        });
      }
    };

    pushMeals("BREAKFAST", frequency.breakfast);
    pushMeals("LUNCH", frequency.lunch);
    pushMeals("DINNER", frequency.dinner);

    return meals;
  };

  beforeEach(async () => {
    createdPlanItems = [];

    mockPrismaService = {
      $transaction: jest
        .fn()
        .mockImplementation(async (callback) => callback(mockPrismaService)),
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser),
      },
      pantryItem: {
        findMany: jest.fn().mockResolvedValue(mockPantryItems),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      meal: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "meal-1",
            title: "Grilled Salmon Bowl",
            estimatedCost: 15.0,
            dietaryTags: ["GLUTEN_FREE"],
            mealType: "DINNER",
            cuisine: "Mediterranean",
          },
          {
            id: "meal-2",
            title: "Lunch Salad",
            estimatedCost: 10.0,
            dietaryTags: ["GLUTEN_FREE"],
            mealType: "LUNCH",
            cuisine: "Mediterranean",
          },
          {
            id: "meal-3",
            title: "Breakfast Bowl",
            estimatedCost: 8.0,
            dietaryTags: ["GLUTEN_FREE"],
            mealType: "BREAKFAST",
            cuisine: "Mediterranean",
          },
        ]),
        create: jest.fn().mockImplementation((args) => ({
          id: `meal-generated-${Math.random()}`,
          ...args.data,
        })),
      },
      mealPlan: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockImplementation((args) => {
          createdPlanItems = args.data.items?.create || [];
          return {
            id: "plan-123",
            ...args.data,
            items: createdPlanItems.map((item, index) => ({
              id: `item-${index}`,
              ...item,
              meal: { id: item.mealId, estimatedCost: 10 },
            })),
          };
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({ id: "plan-123" }),
      },
      mealPlanItem: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({}),
      },
    };

    mockOpenAiService = {
      isAvailable: jest.fn().mockReturnValue(true),
      generateMealPlan: jest.fn().mockImplementation((options) => {
        const frequency = options.overrides.mealFrequency;
        return Promise.resolve({
          planTitle: "Custom Frequency Plan",
          planOverview: "Optimized plan",
          currency: "USD",
          totalEstimatedCost: 80.0,
          dailyTargetCalories: 2200,
          meals: buildAiMeals(frequency),
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealPlansService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OpenAiService, useValue: mockOpenAiService },
      ],
    }).compile();

    service = module.get<MealPlansService>(MealPlansService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  const countByType = (items: Array<{ mealType: string }>) =>
    items.reduce(
      (acc, item) => {
        acc[item.mealType] = (acc[item.mealType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  it("Case 1: generates breakfast=0 lunch=3 dinner=5 (total 8)", async () => {
    const result = await service.generateMealPlan("user-123", {
      mealFrequency: { breakfast: 0, lunch: 3, dinner: 5 },
      weeklyBudget: 115,
      dietaryRestrictions: ["VEGETARIAN"],
      cuisinePreferences: ["ITALIAN", "ASIAN", "MEDITERRANEAN"],
      saveToProfile: true,
    });

    const counts = countByType(createdPlanItems);
    expect(counts.BREAKFAST || 0).toBe(0);
    expect(counts.LUNCH).toBe(3);
    expect(counts.DINNER).toBe(5);
    expect(createdPlanItems).toHaveLength(8);
    expect(result.totalMeals).toBe(8);
    expect(result.mealFrequency).toEqual({ breakfast: 0, lunch: 3, dinner: 5 });
    expect(result.mealPlan).toBeDefined();
    expect((result.mealPlan as { items: unknown[] }).items).toHaveLength(8);
    expect(result.plan).toBe(result.mealPlan);
    expect(result.budgetComparison).toBeDefined();
  });

  it("Case 2: generates breakfast=7 lunch=7 dinner=7 (total 21)", async () => {
    await service.generateMealPlan("user-123", {
      mealFrequency: { breakfast: 7, lunch: 7, dinner: 7 },
    });

    expect(createdPlanItems).toHaveLength(21);
    const counts = countByType(createdPlanItems);
    expect(counts.BREAKFAST).toBe(7);
    expect(counts.LUNCH).toBe(7);
    expect(counts.DINNER).toBe(7);
  });

  it("Case 3: generates breakfast=7 lunch=0 dinner=5 (total 12)", async () => {
    await service.generateMealPlan("user-123", {
      mealFrequency: { breakfast: 7, lunch: 0, dinner: 5 },
    });

    expect(createdPlanItems).toHaveLength(12);
    const counts = countByType(createdPlanItems);
    expect(counts.BREAKFAST).toBe(7);
    expect(counts.LUNCH || 0).toBe(0);
    expect(counts.DINNER).toBe(5);
  });

  it("Case 4: rejects breakfast=0 lunch=0 dinner=0", async () => {
    await expect(
      service.generateMealPlan("user-123", {
        mealFrequency: { breakfast: 0, lunch: 0, dinner: 0 },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("Case 5: archives previous ACTIVE plan and creates a new ACTIVE plan", async () => {
    await service.generateMealPlan("user-123", {
      mealFrequency: { breakfast: 0, lunch: 1, dinner: 1 },
    });

    expect(mockPrismaService.$transaction).toHaveBeenCalled();
    expect(mockPrismaService.mealPlan.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-123",
        status: { in: ["ACTIVE", "Active", "active"] },
      },
      data: { status: "ARCHIVED" },
    });
    expect(mockPrismaService.mealPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });

  it("Case 6: passes dietary restrictions and cuisine preferences into AI generation", async () => {
    await service.generateMealPlan("user-123", {
      mealFrequency: { breakfast: 0, lunch: 2, dinner: 2 },
      dietaryRestrictions: ["VEGETARIAN"],
      cuisinePreferences: ["ITALIAN", "ASIAN"],
    });

    expect(mockOpenAiService.generateMealPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        overrides: expect.objectContaining({
          dietaryRestrictions: ["VEGETARIAN"],
          cuisinePreferences: ["ITALIAN", "ASIAN"],
          mealFrequency: { breakfast: 0, lunch: 2, dinner: 2 },
        }),
      }),
    );
  });

  it("Case 7: returns budget comparison in generation response", async () => {
    const result = await service.generateMealPlan("user-123", {
      mealFrequency: { breakfast: 0, lunch: 2, dinner: 2 },
      weeklyBudget: 115,
    });

    expect(result.weeklyBudget).toBe(115);
    expect(result.totalEstimatedCost).toBeGreaterThan(0);
    expect(result.summaryMessage).toContain("115");
    expect(result.isOverBudget).toBeDefined();
  });

  it("should generate an AI meal plan successfully with store modifier and receipt calibration", async () => {
    const result = await service.generateMealPlan("user-123", {
      mealFrequency: { breakfast: 0, lunch: 1, dinner: 0 },
      preferredStoreType: "ALDI",
      currency: "USD",
    });

    expect(mockOpenAiService.generateMealPlan).toHaveBeenCalledTimes(1);
    expect(result.generationType).toBe("AI_OPENAI");
    expect(result.planTitle).toBe("Custom Frequency Plan");
    expect(result.pricingInsights).toBeDefined();
    expect(result.pricingInsights.preferredStoreType).toBe("ALDI");
    expect(result.pricingInsights.storeMultiplier).toBe(0.82);
  });

  it("should compute historical receipt calibration ratio when past receipts exist (Item 2)", async () => {
    mockPrismaService.mealPlan.findMany.mockResolvedValueOnce([
      { totalEstimatedCost: 100.0, actualCost: 115.0 },
      { totalEstimatedCost: 120.0, actualCost: 135.0 },
    ]);

    const calibration =
      await service.calculateHistoricalCostCalibration("user-123");

    expect(calibration.sampleCount).toBe(2);
    expect(calibration.factor).toBeCloseTo(1.14, 2);
    expect(calibration.message).toContain("+14%");
  });

  it("should correctly resolve store multipliers for different supermarket tiers (Item 3)", () => {
    expect(service.resolveStoreMultiplier("ALDI")).toBe(0.82);
    expect(service.resolveStoreMultiplier("Lidl")).toBe(0.82);
    expect(service.resolveStoreMultiplier("Walmart")).toBe(0.82);
    expect(service.resolveStoreMultiplier("Whole Foods")).toBe(1.3);
    expect(service.resolveStoreMultiplier("Trader Joe's")).toBe(0.95);
    expect(service.resolveStoreMultiplier("Kroger")).toBe(1.0);
    expect(service.resolveStoreMultiplier(undefined)).toBe(1.0);
  });

  it("should fallback gracefully to catalog plan generation when OpenAI is not available", async () => {
    mockOpenAiService.isAvailable.mockReturnValue(false);

    const result = await service.generateMealPlan("user-123", {
      mealFrequency: { breakfast: 0, lunch: 2, dinner: 1 },
    });

    expect(mockOpenAiService.generateMealPlan).not.toHaveBeenCalled();
    expect(result.generationType).toBe("CATALOG_FALLBACK");
    expect(result.plan).toBeDefined();
    expect(createdPlanItems).toHaveLength(3);
  });

  it("should fallback gracefully when OpenAI throws an error", async () => {
    mockOpenAiService.generateMealPlan.mockRejectedValue(
      new Error("OpenAI Rate Limit Exceeded"),
    );

    const result = await service.generateMealPlan("user-123", {
      mealFrequency: { breakfast: 0, lunch: 1, dinner: 1 },
    });

    expect(result.generationType).toBe("CATALOG_FALLBACK");
    expect(result.plan).toBeDefined();
    expect(createdPlanItems).toHaveLength(2);
  });

  it("should support legacy plannedMealTypes × plannedDaysCount for backward compatibility", async () => {
    await service.generateMealPlan("user-123", {
      plannedMealTypes: ["LUNCH", "DINNER"],
      plannedDaysCount: 3,
    });

    expect(createdPlanItems).toHaveLength(6);
    const counts = countByType(createdPlanItems);
    expect(counts.LUNCH).toBe(3);
    expect(counts.DINNER).toBe(3);
    expect(counts.BREAKFAST || 0).toBe(0);
  });

  it("should update a meal plan item successfully", async () => {
    mockPrismaService.mealPlanItem.findUnique.mockResolvedValue({
      id: "item-1",
      mealPlanId: "plan-123",
      mealId: "meal-1",
      dayOfWeek: 1,
      mealType: "LUNCH",
      mealPlan: { userId: "user-123" },
    });

    mockPrismaService.mealPlanItem.update.mockResolvedValue({
      id: "item-1",
      dayOfWeek: 3,
      mealType: "DINNER",
      meal: { id: "meal-1", title: "Grilled Salmon Bowl" },
    });

    const result = await service.updateMealPlanItem("user-123", "item-1", {
      dayOfWeek: 3,
      mealType: "DINNER",
    });

    expect(mockPrismaService.mealPlanItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { dayOfWeek: 3, mealType: "DINNER" },
      include: { meal: true },
    });
    expect(result.mealType).toBe("DINNER");
  });

  it("should delete a meal plan item and recalculate plan cost", async () => {
    mockPrismaService.mealPlanItem.findUnique.mockResolvedValue({
      id: "item-1",
      mealPlanId: "plan-123",
      mealId: "meal-1",
      mealPlan: { userId: "user-123" },
    });

    mockPrismaService.mealPlanItem.delete.mockResolvedValue({ id: "item-1" });
    mockPrismaService.mealPlanItem.findMany.mockResolvedValue([
      { id: "item-2", meal: { estimatedCost: 20.0 } },
    ]);
    mockPrismaService.mealPlan.update.mockResolvedValue({
      id: "plan-123",
      totalEstimatedCost: 20.0,
    });

    const result = await service.deleteMealPlanItem("user-123", "item-1");

    expect(mockPrismaService.mealPlanItem.delete).toHaveBeenCalledWith({
      where: { id: "item-1" },
    });
    expect(mockPrismaService.mealPlan.update).toHaveBeenCalledWith({
      where: { id: "plan-123" },
      data: { totalEstimatedCost: 20.0 },
    });
    expect(result.success).toBe(true);
    expect(result.newTotalEstimatedCost).toBe(20.0);
  });
});

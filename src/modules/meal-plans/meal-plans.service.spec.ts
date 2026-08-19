import { Test, TestingModule } from '@nestjs/testing';
import { MealPlansService } from './meal-plans.service';
import { PrismaService } from '@/database/prisma.service';
import { OpenAiService } from '../ai/openai.service';

describe('MealPlansService', () => {
  let service: MealPlansService;
  let mockPrismaService: any;
  let mockOpenAiService: any;

  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    weeklyBudget: 150.0,
    adultsCount: 2,
    childrenCount: 1,
    plannedMealTypes: ['BREAKFAST', 'LUNCH', 'DINNER'],
    plannedDaysCount: 7,
    dietaryRestrictions: ['GLUTEN_FREE'],
    cuisinePreferences: ['Mediterranean'],
    kitchenEquipment: ['Oven', 'Air Fryer'],
    pantryStaples: ['Olive Oil'],
    mealVibes: ['High-Protein'],
    preferredStoreType: 'DISCOUNT',
    currency: 'USD',
    country: 'United States',
    city: 'Chicago',
  };

  const mockPantryItems = [
    { ingredientName: 'Rice', category: 'Pantry', quantity: 2, unit: 'kg' },
    { ingredientName: 'Chicken Breast', category: 'Meat', quantity: 500, unit: 'g' },
  ];

  beforeEach(async () => {
    mockPrismaService = {
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
            id: 'meal-1',
            title: 'Grilled Salmon Bowl',
            estimatedCost: 15.0,
            dietaryTags: ['GLUTEN_FREE'],
          },
        ]),
        create: jest.fn().mockImplementation((args) => ({
          id: 'meal-generated-id',
          ...args.data,
        })),
      },
      mealPlan: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockImplementation((args) => ({
          id: 'plan-123',
          ...args.data,
          items: args.data.items?.create || [],
        })),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({ id: 'plan-123' }),
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
      generateMealPlan: jest.fn().mockResolvedValue({
        planTitle: '7-Day High-Protein Plan',
        planOverview: 'Optimized Mediterranean weekly plan',
        currency: 'USD',
        totalEstimatedCost: 135.0,
        dailyTargetCalories: 2200,
        meals: [
          {
            dayOfWeek: 1,
            mealType: 'BREAKFAST',
            title: 'Avocado Toast with Poached Egg',
            description: 'Delicious toast with poached egg',
            prepTimeMinutes: 10,
            servings: 3,
            estimatedCost: 5.0,
            cuisine: 'American',
            dietaryTags: ['GLUTEN_FREE', 'HIGH_PROTEIN'],
            instructions: ['Toast gluten-free bread', 'Mash avocado and top with egg'],
            ingredients: [
              { name: 'Gluten-free bread', quantity: '2 slices', category: 'Bakery' },
              { name: 'Egg', quantity: '2 pcs', category: 'Dairy' },
            ],
          },
        ],
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate an AI meal plan successfully with store modifier and receipt calibration', async () => {
    const result = await service.generateMealPlan('user-123', {
      daysCount: 1,
      mealTypes: ['BREAKFAST'],
      preferredStoreType: 'ALDI',
      currency: 'USD',
    });

    expect(mockOpenAiService.generateMealPlan).toHaveBeenCalledTimes(1);
    expect(result.generationType).toBe('AI_OPENAI');
    expect(result.planTitle).toBe('7-Day High-Protein Plan');
    expect(result.pricingInsights).toBeDefined();
    expect(result.pricingInsights.preferredStoreType).toBe('ALDI');
    expect(result.pricingInsights.storeMultiplier).toBe(0.82);
  });

  it('should compute historical receipt calibration ratio when past receipts exist (Item 2)', async () => {
    mockPrismaService.mealPlan.findMany.mockResolvedValueOnce([
      { totalEstimatedCost: 100.0, actualCost: 115.0 },
      { totalEstimatedCost: 120.0, actualCost: 135.0 },
    ]);

    const calibration = await service.calculateHistoricalCostCalibration('user-123');

    expect(calibration.sampleCount).toBe(2);
    // (115 + 135) / (100 + 120) = 250 / 220 = 1.136 -> ~1.14
    expect(calibration.factor).toBeCloseTo(1.14, 2);
    expect(calibration.message).toContain('+14%');
  });

  it('should correctly resolve store multipliers for different supermarket tiers (Item 3)', () => {
    expect(service.resolveStoreMultiplier('ALDI')).toBe(0.82);
    expect(service.resolveStoreMultiplier('Lidl')).toBe(0.82);
    expect(service.resolveStoreMultiplier('Walmart')).toBe(0.82);
    expect(service.resolveStoreMultiplier('Whole Foods')).toBe(1.30);
    expect(service.resolveStoreMultiplier('Trader Joe\'s')).toBe(0.95);
    expect(service.resolveStoreMultiplier('Kroger')).toBe(1.0);
    expect(service.resolveStoreMultiplier(undefined)).toBe(1.0);
  });

  it('should fallback gracefully to catalog plan generation when OpenAI is not available', async () => {
    mockOpenAiService.isAvailable.mockReturnValue(false);

    const result = await service.generateMealPlan('user-123', {
      daysCount: 1,
      mealTypes: ['LUNCH'],
    });

    expect(mockOpenAiService.generateMealPlan).not.toHaveBeenCalled();
    expect(result.generationType).toBe('CATALOG_FALLBACK');
    expect(result.plan).toBeDefined();
  });

  it('should fallback gracefully when OpenAI throws an error', async () => {
    mockOpenAiService.generateMealPlan.mockRejectedValue(new Error('OpenAI Rate Limit Exceeded'));

    const result = await service.generateMealPlan('user-123', {
      daysCount: 1,
      mealTypes: ['LUNCH'],
    });

    expect(result.generationType).toBe('CATALOG_FALLBACK');
    expect(result.plan).toBeDefined();
  });

  it('should update a meal plan item successfully', async () => {
    mockPrismaService.mealPlanItem.findUnique.mockResolvedValue({
      id: 'item-1',
      mealPlanId: 'plan-123',
      mealId: 'meal-1',
      dayOfWeek: 1,
      mealType: 'LUNCH',
      mealPlan: { userId: 'user-123' },
    });

    mockPrismaService.mealPlanItem.update.mockResolvedValue({
      id: 'item-1',
      dayOfWeek: 3,
      mealType: 'DINNER',
      meal: { id: 'meal-1', title: 'Grilled Salmon Bowl' },
    });

    const result = await service.updateMealPlanItem('user-123', 'item-1', {
      dayOfWeek: 3,
      mealType: 'DINNER',
    });

    expect(mockPrismaService.mealPlanItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { dayOfWeek: 3, mealType: 'DINNER' },
      include: { meal: true },
    });
    expect(result.mealType).toBe('DINNER');
  });

  it('should delete a meal plan item and recalculate plan cost', async () => {
    mockPrismaService.mealPlanItem.findUnique.mockResolvedValue({
      id: 'item-1',
      mealPlanId: 'plan-123',
      mealId: 'meal-1',
      mealPlan: { userId: 'user-123' },
    });

    mockPrismaService.mealPlanItem.delete.mockResolvedValue({ id: 'item-1' });
    mockPrismaService.mealPlanItem.findMany.mockResolvedValue([
      { id: 'item-2', meal: { estimatedCost: 20.0 } },
    ]);
    mockPrismaService.mealPlan.update.mockResolvedValue({
      id: 'plan-123',
      totalEstimatedCost: 20.0,
    });

    const result = await service.deleteMealPlanItem('user-123', 'item-1');

    expect(mockPrismaService.mealPlanItem.delete).toHaveBeenCalledWith({
      where: { id: 'item-1' },
    });
    expect(mockPrismaService.mealPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-123' },
      data: { totalEstimatedCost: 20.0 },
    });
    expect(result.success).toBe(true);
    expect(result.newTotalEstimatedCost).toBe(20.0);
  });
});

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { OpenAiService, AiPlanMeal } from '../ai/openai.service';
import { GenerateMealPlanDto } from './dto/generate-meal-plan.dto';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';

@Injectable()
export class MealPlansService {
  private readonly logger = new Logger(MealPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
  ) {}

  /**
   * Generates a personalized meal plan using OpenAI ChatGPT API with automatic fallback.
   */
  async generateMealPlan(userId: string, dto?: GenerateMealPlanDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let pantryItems = await this.prisma.pantryItem.findMany({
      where: { userId },
    });

    // Merge any inline pantry items provided in DTO
    if (dto?.pantryItems && dto.pantryItems.length > 0) {
      const inlinePantry = dto.pantryItems.map((p) => ({
        id: 'inline',
        userId,
        ingredientName: p.ingredientName,
        category: p.category || 'Pantry Staples',
        quantity: p.quantity !== undefined ? p.quantity : 1.0,
        unit: p.unit || 'pcs',
        isLowStock: false,
        expiryDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Combine existing and inline (prevent duplicates)
      const existingNames = new Set(pantryItems.map((p) => p.ingredientName.toLowerCase().trim()));
      for (const item of inlinePantry) {
        if (!existingNames.has(item.ingredientName.toLowerCase().trim())) {
          pantryItems.push(item);
        }
      }

      // If user requested to save to profile / pantry, persist them
      if (dto.saveToProfile) {
        await this.prisma.pantryItem.createMany({
          data: dto.pantryItems.map((p) => ({
            userId,
            ingredientName: p.ingredientName,
            category: p.category || 'Pantry Staples',
            quantity: p.quantity !== undefined ? p.quantity : 1.0,
            unit: p.unit || 'pcs',
            isLowStock: false,
          })),
          skipDuplicates: true,
        });
      }
    }

    const daysCount = dto?.daysCount || dto?.plannedDaysCount || user.plannedDaysCount || 7;
    const mealTypes =
      (dto?.mealTypes && dto.mealTypes.length > 0)
        ? dto.mealTypes
        : (dto?.plannedMealTypes && dto.plannedMealTypes.length > 0)
        ? dto.plannedMealTypes
        : user.plannedMealTypes.length > 0
        ? user.plannedMealTypes
        : ['BREAKFAST', 'LUNCH', 'DINNER'];
    const targetBudget = dto?.weeklyBudget !== undefined ? dto.weeklyBudget : user.weeklyBudget || 150.0;
    const adultsCount = dto?.adultsCount !== undefined ? dto.adultsCount : user.adultsCount || 1;
    const childrenCount = dto?.childrenCount !== undefined ? dto.childrenCount : user.childrenCount || 0;
    const dietaryRestrictions = dto?.dietaryRestrictions || user.dietaryRestrictions || [];
    const cuisinePreferences = dto?.cuisinePreferences || user.cuisinePreferences || [];
    const kitchenEquipment = dto?.kitchenEquipment || user.kitchenEquipment || [];
    const pantryStaples = dto?.pantryStaples || user.pantryStaples || [];
    const mealVibes = dto?.mealVibes || user.mealVibes || [];

    const preferredStoreType = dto?.preferredStoreType || user.preferredStoreType || 'STANDARD';
    const country = dto?.country !== undefined ? dto.country : user.country || 'United Kingdom';
    const city = dto?.city !== undefined ? dto.city : user.city || 'London';
    const currency = dto?.currency || user.currency || 'GBP';

    // Optionally update user profile with provided onboarding settings
    if (dto?.saveToProfile) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          weeklyBudget: targetBudget,
          adultsCount,
          childrenCount,
          plannedDaysCount: daysCount,
          plannedMealTypes: mealTypes,
          dietaryRestrictions,
          cuisinePreferences,
          kitchenEquipment,
          pantryStaples,
          mealVibes,
          preferredStoreType,
          currency,
          country,
          city,
        },
      });
    }

    // Item 2: Compute historical receipt calibration from previous shopping sessions
    const pricingCalibration = await this.calculateHistoricalCostCalibration(userId);

    // Item 3: Compute store and regional price modifier
    const storeMultiplier = this.resolveStoreMultiplier(preferredStoreType);
    const storeModifier = {
      storeType: preferredStoreType,
      storeMultiplier,
      currency,
      country: country || undefined,
      city: city || undefined,
    };

    let generationType: 'AI_OPENAI' | 'CATALOG_FALLBACK' = 'AI_OPENAI';
    let aiOverview: string | undefined;
    let aiTitle: string | undefined;
    let dailyTargetCalories: number | undefined;

    const planItemsData: { mealId: string; dayOfWeek: number; mealType: string }[] = [];
    let totalCost = 0.0;

    if (this.openAiService.isAvailable()) {
      try {
        const aiResult = await this.openAiService.generateMealPlan({
          user: {
            id: user.id,
            firstName: user.firstName,
            weeklyBudget: targetBudget,
            adultsCount,
            childrenCount,
            dietaryRestrictions,
            cuisinePreferences,
            kitchenEquipment,
            pantryStaples,
            mealVibes,
            plannedMealTypes: mealTypes,
            plannedDaysCount: daysCount,
            preferredStoreType,
            currency,
            country,
            city,
          },
          pantryItems,
          overrides: {
            daysCount,
            mealTypes,
            weeklyBudget: targetBudget,
            adultsCount,
            childrenCount,
            dietaryRestrictions,
            cuisinePreferences,
            kitchenEquipment,
            pantryStaples,
            mealVibes,
            includePantryItems: dto?.includePantryItems,
            customNotes: dto?.customNotes,
            preferredStoreType,
            currency,
            country: country || undefined,
            city: city || undefined,
          },
          pricingCalibration,
          storeModifier,
        });

        aiTitle = aiResult.planTitle;
        aiOverview = aiResult.planOverview;
        dailyTargetCalories = aiResult.dailyTargetCalories;

        // Process generated meals: find or create in DB
        for (const aiMeal of aiResult.meals) {
          const mealRecord = await this.findOrCreateAiMeal(aiMeal);
          planItemsData.push({
            mealId: mealRecord.id,
            dayOfWeek: aiMeal.dayOfWeek || 1,
            mealType: aiMeal.mealType || 'LUNCH',
          });
          totalCost += mealRecord.estimatedCost;
        }
      } catch (aiError: any) {
        this.logger.warn(
          `OpenAI plan generation failed (${aiError.message}). Falling back to catalog matching.`,
        );
        generationType = 'CATALOG_FALLBACK';
      }
    } else {
      generationType = 'CATALOG_FALLBACK';
    }

    // Fallback: rule-based generation using database catalog
    if (generationType === 'CATALOG_FALLBACK' || planItemsData.length === 0) {
      const fallbackResult = await this.generateFallbackPlanItems(
        daysCount,
        mealTypes,
        dto?.dietaryRestrictions || user.dietaryRestrictions,
      );
      planItemsData.length = 0;
      planItemsData.push(...fallbackResult.items);
      totalCost = fallbackResult.totalCost;
    }

    // Deactivate previous active plans
    await this.prisma.mealPlan.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + daysCount);

    const newPlan = await this.prisma.mealPlan.create({
      data: {
        userId,
        startDate,
        endDate,
        totalEstimatedCost: Math.round(totalCost * 100) / 100,
        status: 'ACTIVE',
        items: {
          create: planItemsData,
        },
      },
      include: {
        items: {
          include: {
            meal: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
        },
      },
    });

    const budgetDelta = Math.round((totalCost - targetBudget) * 100) / 100;
    const isOverBudget = budgetDelta > 0;

    return {
      plan: newPlan,
      generationType,
      planTitle: aiTitle || `${daysCount}-Day Weekly Meal Plan`,
      planOverview: aiOverview,
      dailyTargetCalories,
      currency,
      weeklyBudget: targetBudget,
      totalEstimatedCost: Math.round(totalCost * 100) / 100,
      budgetDelta: Math.abs(budgetDelta),
      isOverBudget,
      pricingInsights: {
        currency,
        preferredStoreType,
        storeMultiplier,
        historicalCalibrationFactor: pricingCalibration.factor,
        historicalReceiptsSampleCount: pricingCalibration.sampleCount,
        calibrationNote: pricingCalibration.message,
      },
      summaryMessage: isOverBudget
        ? `Est. cost ${currency} ${totalCost.toFixed(2)} / ${currency} ${targetBudget.toFixed(2)} → ${currency} ${budgetDelta.toFixed(2)} over budget`
        : `Est. cost ${currency} ${totalCost.toFixed(2)} / ${currency} ${targetBudget.toFixed(2)} → ${currency} ${Math.abs(budgetDelta).toFixed(2)} under budget`,
    };
  }

  /**
   * Manually creates a custom meal plan from a list of meal items.
   */
  async createManualPlan(userId: string, dto: CreateMealPlanDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Meal plan must contain at least one item');
    }

    // Verify meal IDs
    const mealIds = Array.from(new Set(dto.items.map((i) => i.mealId)));
    const existingMeals = await this.prisma.meal.findMany({
      where: { id: { in: mealIds } },
    });

    if (existingMeals.length !== mealIds.length) {
      throw new BadRequestException('One or more meal IDs are invalid');
    }

    const mealCostMap = new Map(existingMeals.map((m) => [m.id, m.estimatedCost]));
    let totalCost = 0.0;
    for (const item of dto.items) {
      totalCost += mealCostMap.get(item.mealId) || 0.0;
    }

    // Archive previous active plans
    await this.prisma.mealPlan.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    let endDate: Date;
    if (dto.endDate) {
      endDate = new Date(dto.endDate);
    } else {
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
    }

    const newPlan = await this.prisma.mealPlan.create({
      data: {
        userId,
        startDate,
        endDate,
        totalEstimatedCost: Math.round(totalCost * 100) / 100,
        status: 'ACTIVE',
        items: {
          create: dto.items.map((i) => ({
            mealId: i.mealId,
            dayOfWeek: i.dayOfWeek,
            mealType: i.mealType,
          })),
        },
      },
      include: {
        items: {
          include: {
            meal: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
        },
      },
    });

    const budgetDelta = Math.round((totalCost - user.weeklyBudget) * 100) / 100;
    const isOverBudget = budgetDelta > 0;

    return {
      plan: newPlan,
      weeklyBudget: user.weeklyBudget,
      totalEstimatedCost: Math.round(totalCost * 100) / 100,
      budgetDelta: Math.abs(budgetDelta),
      isOverBudget,
      summaryMessage: isOverBudget
        ? `Est. cost $${totalCost.toFixed(2)} / $${user.weeklyBudget.toFixed(2)} → $${budgetDelta.toFixed(2)} over budget`
        : `Est. cost $${totalCost.toFixed(2)} / $${user.weeklyBudget.toFixed(2)} → $${Math.abs(budgetDelta).toFixed(2)} under budget`,
    };
  }

  /**
   * Retrieves current active weekly meal plan for a user.
   */
  async getCurrentPlan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const currentPlan = await this.prisma.mealPlan.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            meal: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
        },
      },
    });

    if (!currentPlan) {
      return {
        hasActivePlan: false,
        message: 'No active meal plan found. Generate a new plan to get started.',
      };
    }

    const weeklyBudget = user?.weeklyBudget || 150.0;
    const budgetDelta = Math.round((currentPlan.totalEstimatedCost - weeklyBudget) * 100) / 100;
    const isOverBudget = budgetDelta > 0;

    return {
      hasActivePlan: true,
      plan: currentPlan,
      weeklyBudget,
      totalEstimatedCost: currentPlan.totalEstimatedCost,
      budgetDelta: Math.abs(budgetDelta),
      isOverBudget,
      summaryBanner: isOverBudget
        ? `Est. cost $${currentPlan.totalEstimatedCost.toFixed(2)} / $${weeklyBudget.toFixed(2)} → $${budgetDelta.toFixed(2)} over budget`
        : `Est. cost $${currentPlan.totalEstimatedCost.toFixed(2)} / $${weeklyBudget.toFixed(2)} → $${Math.abs(budgetDelta).toFixed(2)} under budget`,
    };
  }

  /**
   * Retrieves meal plan history for a user.
   */
  async getPlanHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [plans, total] = await Promise.all([
      this.prisma.mealPlan.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.mealPlan.count({ where: { userId } }),
    ]);

    return {
      data: plans,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a specific meal plan by ID.
   */
  async getPlanById(userId: string, planId: string) {
    const plan = await this.prisma.mealPlan.findUnique({
      where: { id: planId },
      include: {
        items: {
          include: {
            meal: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
        },
      },
    });

    if (!plan || plan.userId !== userId) {
      throw new NotFoundException('Meal plan not found');
    }

    return plan;
  }

  /**
   * Deletes a meal plan by ID.
   */
  async deletePlan(userId: string, planId: string) {
    const plan = await this.prisma.mealPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || plan.userId !== userId) {
      throw new NotFoundException('Meal plan not found');
    }

    await this.prisma.mealPlan.delete({
      where: { id: planId },
    });

    return { success: true, message: 'Meal plan deleted successfully' };
  }

  /**
   * Swaps an individual meal item in the plan with an alternative recipe.
   */
  async swapMealItem(userId: string, itemId: string, newMealId?: string) {
    const item = await this.prisma.mealPlanItem.findUnique({
      where: { id: itemId },
      include: { mealPlan: true, meal: true },
    });

    if (!item || item.mealPlan.userId !== userId) {
      throw new NotFoundException('Meal plan item not found');
    }

    let targetMealId = newMealId;
    if (!targetMealId) {
      // Pick an alternative meal from database
      const alternatives = await this.prisma.meal.findMany({
        where: { id: { not: item.mealId } },
        take: 10,
      });
      if (alternatives.length > 0) {
        targetMealId = alternatives[Math.floor(Math.random() * alternatives.length)].id;
      } else {
        targetMealId = item.mealId;
      }
    }

    const updatedItem = await this.prisma.mealPlanItem.update({
      where: { id: itemId },
      data: { mealId: targetMealId },
      include: { meal: true },
    });

    // Recalculate plan total estimated cost
    const allItems = await this.prisma.mealPlanItem.findMany({
      where: { mealPlanId: item.mealPlanId },
      include: { meal: true },
    });
    const newTotalCost = allItems.reduce((acc, it) => acc + it.meal.estimatedCost, 0);

    await this.prisma.mealPlan.update({
      where: { id: item.mealPlanId },
      data: { totalEstimatedCost: Math.round(newTotalCost * 100) / 100 },
    });

    return updatedItem;
  }

  /**
   * Finds an existing meal by title or creates a new one from AI output.
   */
  private async findOrCreateAiMeal(aiMeal: AiPlanMeal) {
    const existing = await this.prisma.meal.findFirst({
      where: {
        title: {
          equals: aiMeal.title.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.meal.create({
      data: {
        title: aiMeal.title.trim(),
        description: aiMeal.description || null,
        prepTimeMinutes: Number(aiMeal.prepTimeMinutes) || 20,
        servings: Number(aiMeal.servings) || 2,
        estimatedCost: Number(aiMeal.estimatedCost) || 12.0,
        cuisine: aiMeal.cuisine || 'American',
        dietaryTags: Array.isArray(aiMeal.dietaryTags) ? aiMeal.dietaryTags : [],
        instructions: Array.isArray(aiMeal.instructions) ? aiMeal.instructions : [],
        ingredients: Array.isArray(aiMeal.ingredients) ? (aiMeal.ingredients as any) : [],
      },
    });
  }

  /**
   * Fallback heuristic meal plan item selector using database catalog.
   */
  private async generateFallbackPlanItems(
    daysCount: number,
    mealTypes: string[],
    dietaryRestrictions: string[] = [],
  ) {
    let candidateMeals = await this.prisma.meal.findMany({
      where:
        dietaryRestrictions.length > 0
          ? {
              dietaryTags: {
                hasSome: dietaryRestrictions,
              },
            }
          : undefined,
    });

    if (candidateMeals.length === 0) {
      candidateMeals = await this.prisma.meal.findMany({ take: 20 });
    }

    if (candidateMeals.length === 0) {
      // Seed default fallback meal if catalog is completely empty
      const defaultMeal = await this.prisma.meal.create({
        data: {
          title: 'Mediterranean Veggie & Quinoa Bowl',
          description: 'Nutritious roasted vegetables and fluffy quinoa with lemon herb dressing',
          prepTimeMinutes: 20,
          servings: 2,
          estimatedCost: 8.5,
          cuisine: 'Mediterranean',
          dietaryTags: ['VEGETARIAN', 'HIGH_PROTEIN', 'GLUTEN_FREE'],
          instructions: [
            'Cook quinoa in salted water for 15 minutes.',
            'Roast diced vegetables with olive oil, oregano, salt, and pepper.',
            'Assemble bowl with quinoa, roasted veggies, and lemon dressing.',
          ],
          ingredients: [
            { name: 'Quinoa', quantity: '150g', category: 'Grains' },
            { name: 'Zucchini', quantity: '1 medium', category: 'Produce' },
            { name: 'Bell pepper', quantity: '1 pc', category: 'Produce' },
            { name: 'Olive oil', quantity: '2 tbsp', category: 'Pantry Staples' },
            { name: 'Lemon', quantity: '1 pc', category: 'Produce' },
          ],
        },
      });
      candidateMeals = [defaultMeal];
    }

    const items: { mealId: string; dayOfWeek: number; mealType: string }[] = [];
    let totalCost = 0.0;

    for (let day = 1; day <= daysCount; day++) {
      for (const mealType of mealTypes) {
        const mealIndex = (day + mealTypes.indexOf(mealType)) % candidateMeals.length;
        const selected = candidateMeals[mealIndex];
        totalCost += selected.estimatedCost;
        items.push({
          mealId: selected.id,
          dayOfWeek: day,
          mealType,
        });
      }
    }

    return { items, totalCost };
  }

  /**
   * Item 2: Computes pricing calibration factor by analyzing user's previous shopping receipts (actualCost vs estimatedCost).
   */
  async calculateHistoricalCostCalibration(userId: string) {
    const historicalPlans = await this.prisma.mealPlan.findMany({
      where: {
        userId,
        actualCost: { not: null, gt: 0 },
        totalEstimatedCost: { gt: 0 },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (historicalPlans.length === 0) {
      return {
        factor: 1.0,
        sampleCount: 0,
        averageDelta: 0.0,
        message: 'Standard baseline pricing (no previous receipt history logged yet).',
      };
    }

    const sumActual = historicalPlans.reduce((acc, p) => acc + (p.actualCost || 0), 0);
    const sumEstimated = historicalPlans.reduce((acc, p) => acc + p.totalEstimatedCost, 0);

    if (sumEstimated === 0) {
      return {
        factor: 1.0,
        sampleCount: historicalPlans.length,
        averageDelta: 0.0,
        message: 'Standard baseline pricing.',
      };
    }

    let rawFactor = sumActual / sumEstimated;
    // Clamp to safe boundaries (0.65x to 1.50x) to avoid extreme runaway outliers
    rawFactor = Math.max(0.65, Math.min(1.5, rawFactor));
    const factor = Math.round(rawFactor * 100) / 100;
    const avgDelta = Math.round(((sumActual - sumEstimated) / historicalPlans.length) * 100) / 100;
    const deltaPercent = Math.round((factor - 1) * 100);
    const directionText = deltaPercent >= 0 ? `+${deltaPercent}%` : `${deltaPercent}%`;

    return {
      factor,
      sampleCount: historicalPlans.length,
      averageDelta: avgDelta,
      message: `Calibrated with ${directionText} adjustment based on ${historicalPlans.length} previous logged supermarket receipt(s).`,
    };
  }

  /**
   * Item 3: Resolves store benchmark price multiplier based on preferred supermarket tier or chain.
   */
  resolveStoreMultiplier(storeType?: string): number {
    if (!storeType) return 1.0;
    const normalized = storeType.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (
      normalized.includes('DISCOUNT') ||
      normalized.includes('ALDI') ||
      normalized.includes('LIDL') ||
      normalized.includes('WALMART') ||
      normalized.includes('COSTCO') ||
      normalized.includes('WINCO')
    ) {
      return 0.82;
    }

    if (
      normalized.includes('PREMIUM') ||
      normalized.includes('ORGANIC') ||
      normalized.includes('WHOLEFOODS') ||
      normalized.includes('SPROUTS') ||
      normalized.includes('EREWHON') ||
      normalized.includes('MARKSANDSPENCER') ||
      normalized.includes('MS') ||
      normalized.includes('WAITROSE')
    ) {
      return 1.30;
    }

    if (normalized.includes('TRADERJOE') || normalized.includes('TRADERJOES')) {
      return 0.95;
    }

    return 1.0;
  }
}


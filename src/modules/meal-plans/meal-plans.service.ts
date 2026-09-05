import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "@/database/prisma.service";
import { OpenAiService, AiPlanMeal } from "../ai/openai.service";
import { GenerateMealPlanDto } from "./dto/generate-meal-plan.dto";
import { CreateMealPlanDto } from "./dto/create-meal-plan.dto";
import { UpdateMealPlanItemDto } from "./dto/update-meal-plan-item.dto";
import {
  assertValidMealFrequency,
  countMealsByType,
  distributeMealSlots,
  mealFrequencyToLegacy,
  mealFrequencyTotal,
  MealSlot,
  resolveMealFrequency,
  resolvePlanningDaysCount,
} from "./utils/meal-frequency.util";
import {
  buildBudgetComparison,
  withMealPlanResponse,
} from "./utils/meal-plan-response.util";
import { NutritionService } from "../meals/nutrition.service";
import { normalizeCountryAndCurrency } from "@/common/constants/country-currency.constant";
import { normalizeMeasurementSystem } from "@/common/constants/measurement-system.constant";

const MEAL_PLAN_WITH_ITEMS_INCLUDE = {
  items: {
    include: {
      meal: true,
    },
    orderBy: [{ dayOfWeek: "asc" as const }, { mealType: "asc" as const }],
  },
};

const ACTIVE_MEAL_PLAN_STATUSES = ["ACTIVE", "Active", "active"];

@Injectable()
export class MealPlansService {
  private readonly logger = new Logger(MealPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
    private readonly nutritionService: NutritionService,
  ) {}

  /**
   * Generates a personalized meal plan using OpenAI ChatGPT API with automatic fallback.
   */
  async generateMealPlan(userId: string, dto?: GenerateMealPlanDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    let pantryItems = await this.prisma.pantryItem.findMany({
      where: { userId },
    });

    // Merge any inline pantry items provided in DTO
    if (dto?.pantryItems && dto.pantryItems.length > 0) {
      const inlinePantry = dto.pantryItems.map((p) => ({
        id: "inline",
        userId,
        ingredientName: p.ingredientName,
        category: p.category || "Pantry Staples",
        quantity: p.quantity !== undefined ? p.quantity : 1.0,
        unit: p.unit || "pcs",
        isLowStock: false,
        expiryDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Combine existing and inline (prevent duplicates)
      const existingNames = new Set(
        pantryItems.map((p) => p.ingredientName.toLowerCase().trim()),
      );
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
            category: p.category || "Pantry Staples",
            quantity: p.quantity !== undefined ? p.quantity : 1.0,
            unit: p.unit || "pcs",
            isLowStock: false,
          })),
          skipDuplicates: true,
        });
      }
    }

    const mealFrequency = resolveMealFrequency(dto, user);
    assertValidMealFrequency(mealFrequency);

    const daysCount = resolvePlanningDaysCount(
      dto?.daysCount ?? dto?.plannedDaysCount,
      user.plannedDaysCount,
      mealFrequency,
    );
    const legacyMealConfig = mealFrequencyToLegacy(mealFrequency);
    const mealTypes = legacyMealConfig.plannedMealTypes;
    const mealSlots = distributeMealSlots(mealFrequency, daysCount);
    const targetBudget =
      dto?.weeklyBudget !== undefined
        ? dto.weeklyBudget
        : user.weeklyBudget || 150.0;
    const adultsCount =
      dto?.adultsCount !== undefined ? dto.adultsCount : user.adultsCount || 1;
    const childrenCount =
      dto?.childrenCount !== undefined
        ? dto.childrenCount
        : user.childrenCount || 0;
    const dietaryRestrictions =
      dto?.dietaryRestrictions || user.dietaryRestrictions || [];
    const cuisinePreferences =
      dto?.cuisinePreferences || user.cuisinePreferences || [];
    const kitchenEquipment =
      dto?.kitchenEquipment || user.kitchenEquipment || [];
    const pantryStaples = dto?.pantryStaples || user.pantryStaples || [];
    const mealVibes = dto?.mealVibes || user.mealVibes || [];
    const preferredStoreType =
      dto?.preferredStoreType || user.preferredStoreType || "STANDARD";

    const rawCountry = dto?.country !== undefined ? dto.country : user.country;
    const rawCurrency = dto?.currency || user.currency;
    const region = normalizeCountryAndCurrency(rawCountry, rawCurrency);
    const country = region.country;
    const currency = region.currency;
    const measurementSystem = normalizeMeasurementSystem(
      dto?.measurementSystem || (user as any)?.measurementSystem,
      country,
    );
    const city =
      dto?.city !== undefined
        ? dto.city
        : user.city || (country === "United States" ? "New York" : "London");

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
          mealFrequencyBreakfast: mealFrequency.breakfast,
          mealFrequencyLunch: mealFrequency.lunch,
          mealFrequencyDinner: mealFrequency.dinner,
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
    const pricingCalibration =
      await this.calculateHistoricalCostCalibration(userId);

    // Item 3: Compute store and regional price modifier
    const storeMultiplier = this.resolveStoreMultiplier(preferredStoreType);
    const storeModifier = {
      storeType: preferredStoreType,
      storeMultiplier,
      currency,
      country: country || undefined,
      city: city || undefined,
    };

    let generationType: "AI_OPENAI" | "CATALOG_FALLBACK" = "AI_OPENAI";
    let aiOverview: string | undefined;
    let aiTitle: string | undefined;
    let dailyTargetCalories: number | undefined;

    const planItemsData: {
      mealId: string;
      dayOfWeek: number;
      mealType: string;
    }[] = [];
    let totalCost = 0.0;

    if (this.openAiService.isAvailable()) {
      try {
        const aiResult = await this.openAiService.generateMealPlan({
          user: {
            id: user.id,
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
            mealFrequency,
            preferredStoreType,
            currency,
            country,
            city,
            measurementSystem,
          },
          pantryItems,
          overrides: {
            daysCount,
            mealTypes,
            mealFrequency,
            mealSlots,
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
            measurementSystem,
          },
          pricingCalibration,
          storeModifier,
        });

        aiTitle = aiResult.planTitle;
        aiOverview = aiResult.planOverview;
        dailyTargetCalories = aiResult.dailyTargetCalories;

        const alignedMeals = this.alignGeneratedMeals(
          aiResult.meals,
          mealSlots,
        );

        for (const aiMeal of alignedMeals) {
          const mealRecord = await this.findOrCreateAiMeal(aiMeal);
          planItemsData.push({
            mealId: mealRecord.id,
            dayOfWeek: aiMeal.dayOfWeek,
            mealType: aiMeal.mealType,
          });
          totalCost += mealRecord.estimatedCost;
        }
      } catch (aiError: any) {
        this.logger.warn(
          `OpenAI plan generation failed (${aiError.message}). Falling back to catalog matching.`,
        );
        generationType = "CATALOG_FALLBACK";
      }
    } else {
      generationType = "CATALOG_FALLBACK";
    }

    // Fallback: rule-based generation using database catalog
    if (generationType === "CATALOG_FALLBACK" || planItemsData.length === 0) {
      const fallbackResult = await this.generateFallbackPlanItems(
        mealSlots,
        dto?.dietaryRestrictions || user.dietaryRestrictions,
        dto?.cuisinePreferences || user.cuisinePreferences,
      );
      planItemsData.length = 0;
      planItemsData.push(...fallbackResult.items);
      totalCost = fallbackResult.totalCost;
    }

    // Enforce 100% variety across all days in the plan (zero duplicates across Day 1, Day 2, etc.)
    const uniquePlanItems = await this.ensurePlanMealVariety(
      planItemsData,
      dto?.dietaryRestrictions || user.dietaryRestrictions,
      dto?.cuisinePreferences || user.cuisinePreferences,
    );
    planItemsData.length = 0;
    planItemsData.push(...uniquePlanItems);

    // Recalculate total estimated cost accurately
    const planMealRecords = await this.prisma.meal.findMany({
      where: { id: { in: planItemsData.map((it) => it.mealId) } },
    });
    const costMap = new Map(
      planMealRecords.map((m) => [m.id, m.estimatedCost]),
    );
    totalCost = planItemsData.reduce(
      (acc, it) => acc + (costMap.get(it.mealId) || 0),
      0,
    );

    this.assertPlanItemCounts(planItemsData, mealFrequency);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + daysCount);

    const newPlan = await this.prisma.$transaction(async (tx) => {
      await this.archiveActiveMealPlans(userId, tx);

      return tx.mealPlan.create({
        data: {
          userId,
          startDate,
          endDate,
          totalEstimatedCost: Math.round(totalCost * 100) / 100,
          status: "ACTIVE",
          items: {
            create: planItemsData,
          },
        },
        include: MEAL_PLAN_WITH_ITEMS_INCLUDE,
      });
    });

    const budgetComparison = buildBudgetComparison(
      targetBudget,
      totalCost,
      currency,
    );

    return withMealPlanResponse(
      {
        generationType,
        planTitle:
          aiTitle || `${mealFrequencyTotal(mealFrequency)}-Meal Weekly Plan`,
        planOverview: aiOverview,
        dailyTargetCalories,
        currency,
        mealFrequency,
        totalMeals: mealFrequencyTotal(mealFrequency),
        budgetComparison,
        weeklyBudget: targetBudget,
        totalEstimatedCost: budgetComparison.totalEstimatedCost,
        budgetDelta: budgetComparison.budgetDelta,
        isOverBudget: budgetComparison.isOverBudget,
        summaryMessage: budgetComparison.message,
        pricingInsights: {
          currency,
          preferredStoreType,
          storeMultiplier,
          historicalCalibrationFactor: pricingCalibration.factor,
          historicalReceiptsSampleCount: pricingCalibration.sampleCount,
          calibrationNote: pricingCalibration.message,
        },
      },
      newPlan,
    );
  }

  /**
   * Manually creates a custom meal plan from a list of meal items.
   */
  async createManualPlan(userId: string, dto: CreateMealPlanDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("Meal plan must contain at least one item");
    }

    // Verify meal IDs
    const mealIds = Array.from(new Set(dto.items.map((i) => i.mealId)));
    const existingMeals = await this.prisma.meal.findMany({
      where: { id: { in: mealIds } },
    });

    if (existingMeals.length !== mealIds.length) {
      throw new BadRequestException("One or more meal IDs are invalid");
    }

    const mealCostMap = new Map(
      existingMeals.map((m) => [m.id, m.estimatedCost]),
    );
    let totalCost = 0.0;
    for (const item of dto.items) {
      totalCost += mealCostMap.get(item.mealId) || 0.0;
    }

    // Archive previous active plans and create the new plan atomically
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    let endDate: Date;
    if (dto.endDate) {
      endDate = new Date(dto.endDate);
    } else {
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
    }

    const newPlan = await this.prisma.$transaction(async (tx) => {
      await this.archiveActiveMealPlans(userId, tx);

      return tx.mealPlan.create({
        data: {
          userId,
          startDate,
          endDate,
          totalEstimatedCost: Math.round(totalCost * 100) / 100,
          status: "ACTIVE",
          items: {
            create: dto.items.map((i) => ({
              mealId: i.mealId,
              dayOfWeek: i.dayOfWeek,
              mealType: i.mealType,
            })),
          },
        },
        include: MEAL_PLAN_WITH_ITEMS_INCLUDE,
      });
    });

    const region = normalizeCountryAndCurrency(user.country, user.currency);
    const budgetComparison = buildBudgetComparison(
      user.weeklyBudget,
      totalCost,
      region.currency,
    );

    return withMealPlanResponse(
      {
        budgetComparison,
        weeklyBudget: user.weeklyBudget,
        totalEstimatedCost: budgetComparison.totalEstimatedCost,
        budgetDelta: budgetComparison.budgetDelta,
        isOverBudget: budgetComparison.isOverBudget,
        summaryMessage: budgetComparison.message,
      },
      newPlan,
    );
  }

  /**
   * Retrieves current active weekly meal plan for a user.
   */
  async getCurrentPlan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const currentPlan = await this.prisma.mealPlan.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_MEAL_PLAN_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      include: MEAL_PLAN_WITH_ITEMS_INCLUDE,
    });

    if (!currentPlan) {
      return {
        hasActivePlan: false,
        mealPlan: null,
        plan: null,
        message:
          "No active meal plan found. Generate a new plan to get started.",
      };
    }

    const weeklyBudget = user?.weeklyBudget || 150.0;
    const region = normalizeCountryAndCurrency(user?.country, user?.currency);
    const currency = region.currency;
    const budgetComparison = buildBudgetComparison(
      weeklyBudget,
      currentPlan.totalEstimatedCost,
      currency,
    );

    return withMealPlanResponse(
      {
        hasActivePlan: true,
        budgetComparison,
        weeklyBudget,
        totalEstimatedCost: budgetComparison.totalEstimatedCost,
        budgetDelta: budgetComparison.budgetDelta,
        isOverBudget: budgetComparison.isOverBudget,
        summaryBanner: budgetComparison.message,
        summaryMessage: budgetComparison.message,
      },
      currentPlan,
    );
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
        orderBy: { createdAt: "desc" },
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
          orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
        },
      },
    });

    if (!plan || plan.userId !== userId) {
      throw new NotFoundException("Meal plan not found");
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
      throw new NotFoundException("Meal plan not found");
    }

    await this.prisma.mealPlan.delete({
      where: { id: planId },
    });

    return { success: true, message: "Meal plan deleted successfully" };
  }

  /**
   * Retrieves AI and catalog alternative meal recommendations for a specific meal slot in the active plan.
   * Excludes all meals currently scheduled in the plan to guarantee zero repetition.
   */
  async getSwapAlternatives(userId: string, itemId: string, targetCount = 6) {
    const item = await this.prisma.mealPlanItem.findUnique({
      where: { id: itemId },
      include: {
        mealPlan: {
          include: {
            items: {
              select: { mealId: true },
            },
          },
        },
        meal: true,
      },
    });

    if (!item || item.mealPlan.userId !== userId) {
      throw new NotFoundException("Meal plan item not found");
    }

    const currentMeal = item.meal;
    const currentPrice = currentMeal.estimatedCost;
    const mealSlot = item.mealType; // BREAKFAST, LUNCH, or DINNER

    // Gather all active plan meal IDs to prevent repetition
    const activePlanMealIds = new Set(
      item.mealPlan.items.map((it) => it.mealId),
    );

    // Query candidate meals from catalog matching slot
    const catalogCandidates = await this.prisma.meal.findMany({
      where: {
        id: { notIn: Array.from(activePlanMealIds) },
      },
      take: 20,
      orderBy: { cookedCount: "desc" },
    });

    const alternatives = catalogCandidates.slice(0, targetCount).map((m) => {
      const priceDelta =
        Math.round((m.estimatedCost - currentPrice) * 100) / 100;
      const priceComparison =
        priceDelta < 0
          ? `-$${Math.abs(priceDelta).toFixed(2)} cheaper`
          : priceDelta === 0
            ? "Same price"
            : `+$${priceDelta.toFixed(2)}`;

      const nutrition = this.nutritionService.calculateMealNutrition({
        title: m.title,
        mealType: mealSlot,
        servings: m.servings,
        ingredients: m.ingredients,
        dietaryTags: m.dietaryTags,
      });

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        estimatedCost: m.estimatedCost,
        priceDelta,
        priceComparison,
        prepTimeMinutes: m.prepTimeMinutes,
        servings: m.servings,
        cuisine: m.cuisine,
        dietaryTags: m.dietaryTags,
        calories: nutrition.calories,
        proteinGrams: nutrition.proteinGrams,
        carbsGrams: nutrition.carbsGrams,
        fatGrams: nutrition.fatGrams,
        imageUrl: m.imageUrl,
        whyRecommended:
          priceDelta < 0
            ? `Saves $${Math.abs(priceDelta).toFixed(2)} compared to current ${mealSlot.toLowerCase()}`
            : `Delicious ${m.cuisine} ${mealSlot.toLowerCase()} option`,
      };
    });

    return {
      targetItem: {
        id: item.id,
        dayOfWeek: item.dayOfWeek,
        mealType: item.mealType,
        currentMeal: {
          id: currentMeal.id,
          title: currentMeal.title,
          estimatedCost: currentMeal.estimatedCost,
          calories:
            this.nutritionService.calculateMealNutrition(currentMeal).calories,
        },
      },
      count: alternatives.length,
      alternatives,
    };
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
      throw new NotFoundException("Meal plan item not found");
    }

    let targetMealId = newMealId;
    if (!targetMealId) {
      // Pick an alternative meal from database
      const alternatives = await this.prisma.meal.findMany({
        where: { id: { not: item.mealId } },
        take: 10,
      });
      if (alternatives.length > 0) {
        targetMealId =
          alternatives[Math.floor(Math.random() * alternatives.length)].id;
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
    const newTotalCost = allItems.reduce(
      (acc, it) => acc + it.meal.estimatedCost,
      0,
    );

    const updatedPlan = await this.prisma.mealPlan.update({
      where: { id: item.mealPlanId },
      data: { totalEstimatedCost: Math.round(newTotalCost * 100) / 100 },
      include: {
        items: {
          include: { meal: true },
          orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
        },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const targetBudget = user?.weeklyBudget || 150.0;
    const region = normalizeCountryAndCurrency(user?.country, user?.currency);
    const budgetComparison = buildBudgetComparison(
      targetBudget,
      updatedPlan.totalEstimatedCost,
      region.currency,
    );

    return {
      item: updatedItem,
      mealPlan: updatedPlan,
      plan: updatedPlan,
      totalEstimatedCost: updatedPlan.totalEstimatedCost,
      budgetDelta: budgetComparison.budgetDelta,
      isOverBudget: budgetComparison.isOverBudget,
      budgetComparison,
      summaryMessage: `Swapped to ${updatedItem.meal.title}. Total plan cost is now ${budgetComparison.currency} ${updatedPlan.totalEstimatedCost.toFixed(2)}.`,
    };
  }

  /**
   * Finds an existing meal by title or creates a new one from AI output.
   */
  private async findOrCreateAiMeal(aiMeal: AiPlanMeal) {
    const existing = await this.prisma.meal.findFirst({
      where: {
        title: {
          equals: aiMeal.title.trim(),
          mode: "insensitive",
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
        cuisine: aiMeal.cuisine || "American",
        dietaryTags: Array.isArray(aiMeal.dietaryTags)
          ? aiMeal.dietaryTags
          : [],
        instructions: Array.isArray(aiMeal.instructions)
          ? aiMeal.instructions
          : [],
        ingredients: Array.isArray(aiMeal.ingredients)
          ? (aiMeal.ingredients as any)
          : [],
      },
    });
  }

  /**
   * Archives all active meal plans for a user before creating a new one.
   */
  private async archiveActiveMealPlans(
    userId: string,
    tx: Pick<PrismaService, "mealPlan"> = this.prisma,
  ): Promise<number> {
    const result = await tx.mealPlan.updateMany({
      where: {
        userId,
        status: { in: ACTIVE_MEAL_PLAN_STATUSES },
      },
      data: { status: "ARCHIVED" },
    });

    if (result.count > 0) {
      this.logger.log(
        `Archived ${result.count} active meal plan(s) for user ${userId}`,
      );
    }

    return result.count;
  }

  /**
   * Aligns AI meals to required slots, enforcing exact per-type counts.
   */
  private alignGeneratedMeals(
    aiMeals: AiPlanMeal[],
    mealSlots: MealSlot[],
  ): AiPlanMeal[] {
    if (mealSlots.length === 0) {
      return aiMeals;
    }

    const mealsByType: Record<string, AiPlanMeal[]> = {
      BREAKFAST: [],
      LUNCH: [],
      DINNER: [],
    };
    const unassigned: AiPlanMeal[] = [];

    for (const meal of aiMeals) {
      const normalized = (meal.mealType || "").trim().toUpperCase();
      if (normalized in mealsByType) {
        mealsByType[normalized].push(meal);
      } else {
        unassigned.push(meal);
      }
    }

    const aligned: AiPlanMeal[] = [];

    for (const slot of mealSlots) {
      const pool = mealsByType[slot.mealType];
      const meal = pool.shift() || unassigned.shift();

      if (!meal) {
        throw new Error(`Insufficient AI meals generated for ${slot.mealType}`);
      }

      aligned.push({
        ...meal,
        dayOfWeek: slot.dayOfWeek,
        mealType: slot.mealType,
      });
    }

    return aligned;
  }

  private assertPlanItemCounts(
    planItems: Array<{ mealType: string }>,
    mealFrequency: { breakfast: number; lunch: number; dinner: number },
  ): void {
    const counts = countMealsByType(planItems);

    if (
      counts.BREAKFAST !== mealFrequency.breakfast ||
      counts.LUNCH !== mealFrequency.lunch ||
      counts.DINNER !== mealFrequency.dinner
    ) {
      throw new BadRequestException(
        `Generated meal plan does not match requested frequencies. Expected breakfast=${mealFrequency.breakfast}, lunch=${mealFrequency.lunch}, dinner=${mealFrequency.dinner}; got breakfast=${counts.BREAKFAST}, lunch=${counts.LUNCH}, dinner=${counts.DINNER}.`,
      );
    }
  }

  /**
   * Enforces 100% distinct, non-repetitive meals across all days in the generated weekly plan.
   * If any duplicate meal title or meal ID is found on a subsequent day, replaces it with a unique candidate.
   */
  private async ensurePlanMealVariety(
    planItemsData: { mealId: string; dayOfWeek: number; mealType: string }[],
    dietaryRestrictions: string[] = [],
    cuisinePreferences: string[] = [],
  ): Promise<{ mealId: string; dayOfWeek: number; mealType: string }[]> {
    const seenMealIds = new Set<string>();
    const seenTitles = new Set<string>();
    const uniqueItems: typeof planItemsData = [];

    // Pre-fetch meal details for all initial items
    const initialMealIds = planItemsData.map((it) => it.mealId);
    const initialMeals = await this.prisma.meal.findMany({
      where: { id: { in: initialMealIds } },
    });
    const mealMap = new Map<string, (typeof initialMeals)[0]>();
    for (const m of initialMeals) {
      mealMap.set(m.id, m);
    }

    for (const item of planItemsData) {
      const currentMeal = mealMap.get(item.mealId);
      const normalizedTitle = (currentMeal?.title || "").toLowerCase().trim();

      const isDuplicate =
        seenMealIds.has(item.mealId) ||
        (normalizedTitle.length > 0 && seenTitles.has(normalizedTitle));

      if (!isDuplicate && currentMeal) {
        seenMealIds.add(item.mealId);
        seenTitles.add(normalizedTitle);
        uniqueItems.push(item);
        continue;
      }

      this.logger.warn(
        `Duplicate meal detected for Day ${item.dayOfWeek} (${item.mealType}: "${currentMeal?.title || item.mealId}"). Finding a unique alternative...`,
      );

      // Query alternative meals matching the exact slot and dietary restrictions not in seenMealIds
      const candidates = await this.prisma.meal.findMany({
        where: {
          id: { notIn: Array.from(seenMealIds) },
          mealType: { equals: item.mealType, mode: "insensitive" },
          ...(dietaryRestrictions.length > 0
            ? { dietaryTags: { hasSome: dietaryRestrictions } }
            : {}),
        },
        take: 15,
        orderBy: { cookedCount: "desc" },
      });

      let replacementMeal = candidates.find(
        (c) => !seenTitles.has(c.title.toLowerCase().trim()),
      );

      if (!replacementMeal) {
        // Broaden search across all meal types not in seenMealIds
        const broaderCandidates = await this.prisma.meal.findMany({
          where: {
            id: { notIn: Array.from(seenMealIds) },
            ...(dietaryRestrictions.length > 0
              ? { dietaryTags: { hasSome: dietaryRestrictions } }
              : {}),
          },
          take: 25,
        });
        replacementMeal = broaderCandidates.find(
          (c) => !seenTitles.has(c.title.toLowerCase().trim()),
        );
      }

      if (replacementMeal) {
        seenMealIds.add(replacementMeal.id);
        seenTitles.add(replacementMeal.title.toLowerCase().trim());
        mealMap.set(replacementMeal.id, replacementMeal);
        uniqueItems.push({
          mealId: replacementMeal.id,
          dayOfWeek: item.dayOfWeek,
          mealType: item.mealType,
        });
      } else {
        // If all existing DB records are exhausted, retain current item
        seenMealIds.add(item.mealId);
        if (normalizedTitle) seenTitles.add(normalizedTitle);
        uniqueItems.push(item);
      }
    }

    return uniqueItems;
  }

  /**
   * Fallback heuristic meal plan item selector using database catalog with 100% non-repetition guarantee.
   */
  private async generateFallbackPlanItems(
    mealSlots: MealSlot[],
    dietaryRestrictions: string[] = [],
    cuisinePreferences: string[] = [],
  ) {
    let candidateMeals = await this.prisma.meal.findMany({
      where: {
        AND: [
          dietaryRestrictions.length > 0
            ? { dietaryTags: { hasSome: dietaryRestrictions } }
            : {},
          cuisinePreferences.length > 0
            ? {
                OR: cuisinePreferences.map((cuisine) => ({
                  cuisine: { equals: cuisine, mode: "insensitive" as const },
                })),
              }
            : {},
        ],
      },
    });

    if (candidateMeals.length === 0 && dietaryRestrictions.length > 0) {
      candidateMeals = await this.prisma.meal.findMany({
        where: {
          dietaryTags: {
            hasSome: dietaryRestrictions,
          },
        },
      });
    }

    if (candidateMeals.length === 0) {
      candidateMeals = await this.prisma.meal.findMany({ take: 50 });
    }

    if (candidateMeals.length === 0) {
      // Seed default fallback meal if catalog is completely empty
      const defaultMeal = await this.prisma.meal.create({
        data: {
          title: "Mediterranean Veggie & Quinoa Bowl",
          description:
            "Nutritious roasted vegetables and fluffy quinoa with lemon herb dressing",
          prepTimeMinutes: 20,
          servings: 2,
          estimatedCost: 8.5,
          cuisine: "Mediterranean",
          dietaryTags: ["VEGETARIAN", "HIGH_PROTEIN", "GLUTEN_FREE"],
          instructions: [
            "Cook quinoa in salted water for 15 minutes.",
            "Roast diced vegetables with olive oil, oregano, salt, and pepper.",
            "Assemble bowl with quinoa, roasted veggies, and lemon dressing.",
          ],
          ingredients: [
            { name: "Quinoa", quantity: "150g", category: "Grains" },
            { name: "Zucchini", quantity: "1 medium", category: "Produce" },
            { name: "Bell pepper", quantity: "1 pc", category: "Produce" },
            {
              name: "Olive oil",
              quantity: "2 tbsp",
              category: "Pantry Staples",
            },
            { name: "Lemon", quantity: "1 pc", category: "Produce" },
          ],
        },
      });
      candidateMeals = [defaultMeal];
    }

    const usedMealIds = new Set<string>();
    const usedTitles = new Set<string>();
    const items: { mealId: string; dayOfWeek: number; mealType: string }[] = [];
    let totalCost = 0.0;

    for (const slot of mealSlots) {
      // Find candidate matching slot, dietary, not used yet
      let pool = candidateMeals.filter(
        (m) =>
          m.mealType?.toUpperCase() === slot.mealType &&
          !usedMealIds.has(m.id) &&
          !usedTitles.has(m.title.toLowerCase().trim()),
      );

      // If slot pool exhausted, query directly from database for slot
      if (pool.length === 0) {
        const slotDbMeals = await this.prisma.meal.findMany({
          where: {
            id: { notIn: Array.from(usedMealIds) },
            mealType: { equals: slot.mealType, mode: "insensitive" },
            ...(dietaryRestrictions.length > 0
              ? { dietaryTags: { hasSome: dietaryRestrictions } }
              : {}),
          },
          take: 25,
        });
        pool = slotDbMeals.filter(
          (m) => !usedTitles.has(m.title.toLowerCase().trim()),
        );
      }

      // If still empty, query any unused meal matching dietary
      if (pool.length === 0) {
        const anyDietaryMeals = await this.prisma.meal.findMany({
          where: {
            id: { notIn: Array.from(usedMealIds) },
            ...(dietaryRestrictions.length > 0
              ? { dietaryTags: { hasSome: dietaryRestrictions } }
              : {}),
          },
          take: 25,
        });
        pool = anyDietaryMeals.filter(
          (m) => !usedTitles.has(m.title.toLowerCase().trim()),
        );
      }

      // If still empty, query any unused catalog meal
      if (pool.length === 0) {
        const anyUnused = await this.prisma.meal.findMany({
          where: {
            id: { notIn: Array.from(usedMealIds) },
          },
          take: 25,
        });
        pool = anyUnused.filter(
          (m) => !usedTitles.has(m.title.toLowerCase().trim()),
        );
      }

      // If catalog is entirely exhausted, fallback to available candidate
      const selected =
        pool.length > 0
          ? pool[Math.floor(Math.random() * pool.length)]
          : candidateMeals[0];

      if (selected) {
        usedMealIds.add(selected.id);
        usedTitles.add(selected.title.toLowerCase().trim());
        totalCost += selected.estimatedCost;
        items.push({
          mealId: selected.id,
          dayOfWeek: slot.dayOfWeek,
          mealType: slot.mealType,
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
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (historicalPlans.length === 0) {
      return {
        factor: 1.0,
        sampleCount: 0,
        averageDelta: 0.0,
        message:
          "Standard baseline pricing (no previous receipt history logged yet).",
      };
    }

    const sumActual = historicalPlans.reduce(
      (acc, p) => acc + (p.actualCost || 0),
      0,
    );
    const sumEstimated = historicalPlans.reduce(
      (acc, p) => acc + p.totalEstimatedCost,
      0,
    );

    if (sumEstimated === 0) {
      return {
        factor: 1.0,
        sampleCount: historicalPlans.length,
        averageDelta: 0.0,
        message: "Standard baseline pricing.",
      };
    }

    let rawFactor = sumActual / sumEstimated;
    // Clamp to safe boundaries (0.65x to 1.50x) to avoid extreme runaway outliers
    rawFactor = Math.max(0.65, Math.min(1.5, rawFactor));
    const factor = Math.round(rawFactor * 100) / 100;
    const avgDelta =
      Math.round(((sumActual - sumEstimated) / historicalPlans.length) * 100) /
      100;
    const deltaPercent = Math.round((factor - 1) * 100);
    const directionText =
      deltaPercent >= 0 ? `+${deltaPercent}%` : `${deltaPercent}%`;

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
    const normalized = storeType
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (
      normalized.includes("DISCOUNT") ||
      normalized.includes("ALDI") ||
      normalized.includes("LIDL") ||
      normalized.includes("WALMART") ||
      normalized.includes("COSTCO") ||
      normalized.includes("WINCO")
    ) {
      return 0.82;
    }

    if (
      normalized.includes("PREMIUM") ||
      normalized.includes("ORGANIC") ||
      normalized.includes("WHOLEFOODS") ||
      normalized.includes("SPROUTS") ||
      normalized.includes("EREWHON") ||
      normalized.includes("MARKSANDSPENCER") ||
      normalized.includes("MS") ||
      normalized.includes("WAITROSE")
    ) {
      return 1.3;
    }

    if (normalized.includes("TRADERJOE") || normalized.includes("TRADERJOES")) {
      return 0.95;
    }

    return 1.0;
  }

  /**
   * Updates an individual planned meal item (day of week, meal slot, status, or recipe).
   */
  async updateMealPlanItem(
    userId: string,
    itemId: string,
    dto: UpdateMealPlanItemDto,
  ) {
    const item = await this.prisma.mealPlanItem.findUnique({
      where: { id: itemId },
      include: { mealPlan: true, meal: true },
    });

    if (!item || item.mealPlan.userId !== userId) {
      throw new NotFoundException("Meal plan item not found");
    }

    const data: any = {};
    if (dto.dayOfWeek !== undefined) {
      data.dayOfWeek = dto.dayOfWeek;
    }
    if (dto.mealType !== undefined) {
      data.mealType = dto.mealType.toUpperCase();
    }
    if (dto.isCooked !== undefined) {
      data.isCooked = dto.isCooked;
    }
    if (dto.mealId !== undefined && dto.mealId !== item.mealId) {
      const meal = await this.prisma.meal.findUnique({
        where: { id: dto.mealId },
      });
      if (!meal) {
        throw new NotFoundException(`Meal with ID "${dto.mealId}" not found`);
      }
      data.mealId = dto.mealId;
    }

    const updatedItem = await this.prisma.mealPlanItem.update({
      where: { id: itemId },
      data,
      include: { meal: true },
    });

    // If meal was replaced, recalculate plan total estimated cost
    if (dto.mealId !== undefined && dto.mealId !== item.mealId) {
      const allItems = await this.prisma.mealPlanItem.findMany({
        where: { mealPlanId: item.mealPlanId },
        include: { meal: true },
      });
      const newTotalCost = allItems.reduce(
        (acc, it) => acc + (it.meal?.estimatedCost || 0),
        0,
      );
      await this.prisma.mealPlan.update({
        where: { id: item.mealPlanId },
        data: { totalEstimatedCost: Math.round(newTotalCost * 100) / 100 },
      });
    }

    return updatedItem;
  }

  /**
   * Deletes a planned meal item and recalculates the total estimated cost of the meal plan.
   */
  async deleteMealPlanItem(userId: string, itemId: string) {
    const item = await this.prisma.mealPlanItem.findUnique({
      where: { id: itemId },
      include: { mealPlan: true, meal: true },
    });

    if (!item || item.mealPlan.userId !== userId) {
      throw new NotFoundException("Meal plan item not found");
    }

    await this.prisma.mealPlanItem.delete({
      where: { id: itemId },
    });

    // Recalculate plan total estimated cost
    const remainingItems = await this.prisma.mealPlanItem.findMany({
      where: { mealPlanId: item.mealPlanId },
      include: { meal: true },
    });

    const newTotalCost = remainingItems.reduce(
      (acc, it) => acc + (it.meal?.estimatedCost || 0),
      0,
    );

    await this.prisma.mealPlan.update({
      where: { id: item.mealPlanId },
      data: { totalEstimatedCost: Math.round(newTotalCost * 100) / 100 },
    });

    return {
      success: true,
      message: "Meal plan item removed successfully",
      remainingItemsCount: remainingItems.length,
      newTotalEstimatedCost: Math.round(newTotalCost * 100) / 100,
    };
  }
}

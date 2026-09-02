import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "@/database/prisma.service";
import { OpenAiService, AiRecommendedMeal } from "../ai/openai.service";
import { RecommendMealsDto } from "./dto/recommend-meals.dto";
import { NutritionService } from "./nutrition.service";

@Injectable()
export class MealsService {
  private readonly logger = new Logger(MealsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
    private readonly nutritionService: NutritionService,
  ) {}

  /**
   * Enriches meal record with calculated calories per adult serving and macro breakdown.
   */
  formatMealWithNutrition(meal: any) {
    if (!meal) return meal;

    let calories = Number(meal.calories) || 0;
    let proteinGrams =
      meal.proteinGrams !== undefined && meal.proteinGrams !== null
        ? Number(meal.proteinGrams)
        : undefined;
    let carbsGrams =
      meal.carbsGrams !== undefined && meal.carbsGrams !== null
        ? Number(meal.carbsGrams)
        : undefined;
    let fatGrams =
      meal.fatGrams !== undefined && meal.fatGrams !== null
        ? Number(meal.fatGrams)
        : undefined;

    // If calories is 0 or missing, calculate dynamically from ingredients and servings
    if (calories <= 0) {
      const calculated = this.nutritionService.calculateMealNutrition(meal);
      calories = calculated.calories;
      proteinGrams = proteinGrams ?? calculated.proteinGrams;
      carbsGrams = carbsGrams ?? calculated.carbsGrams;
      fatGrams = fatGrams ?? calculated.fatGrams;
    }

    return {
      ...meal,
      calories,
      caloriesPerServing: calories,
      caloriesPerAdult: calories,
      proteinGrams,
      carbsGrams,
      fatGrams,
    };
  }

  async findAll(query: {
    cuisine?: string;
    dietaryTag?: string;
    dietaryTags?: string;
    search?: string;
    maxPrepTime?: number;
    maxCost?: number;
    sortBy?:
      | "title"
      | "estimatedCost"
      | "prepTimeMinutes"
      | "cookedCount"
      | "createdAt";
    sortOrder?: "asc" | "desc";
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.cuisine) {
      where.cuisine = { equals: query.cuisine, mode: "insensitive" };
    }

    const tagsToFilter = query.dietaryTags
      ? query.dietaryTags.split(",").map((t) => t.trim().toUpperCase())
      : query.dietaryTag
        ? [query.dietaryTag.trim().toUpperCase()]
        : [];

    if (tagsToFilter.length > 0) {
      where.dietaryTags = { hasSome: tagsToFilter };
    }

    if (query.maxPrepTime) {
      where.prepTimeMinutes = { lte: Number(query.maxPrepTime) };
    }

    if (query.maxCost) {
      where.estimatedCost = { lte: Number(query.maxCost) };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { cuisine: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const orderByField = query.sortBy || "title";
    const orderDirection = query.sortOrder || "asc";

    const [meals, total] = await Promise.all([
      this.prisma.meal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderDirection },
      }),
      this.prisma.meal.count({ where }),
    ]);

    const formattedMeals = meals.map((m) => this.formatMealWithNutrition(m));

    return {
      data: formattedMeals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const meal = await this.prisma.meal.findUnique({
      where: { id },
    });

    if (!meal) {
      throw new NotFoundException(`Meal with ID "${id}" not found`);
    }

    return this.formatMealWithNutrition(meal);
  }

  /**
   * Generates dynamic, AI-driven, and highly personalized food recommendations.
   * Avoids repetitive meals and incorporates pantry stock, user preferences, and accurate calories.
   */
  async getRecommendations(userId: string | null, dto: RecommendMealsDto = {}) {
    const targetCount = Math.max(1, Math.min(20, Number(dto.count) || 5));

    // 1. Fetch user context if authenticated
    let user: any = null;
    let pantryItems: any[] = [];
    const recentMealTitles: string[] = [];
    const recentMealIds: string[] = [];

    if (userId) {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (dto.includePantry !== false) {
        pantryItems = await this.prisma.pantryItem.findMany({
          where: { userId },
          take: 30,
        });
      }

      // Fetch recent meal plans (last 3) to prevent repetitive suggestions
      const recentPlans = await this.prisma.mealPlan.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          items: {
            include: { meal: true },
          },
        },
      });

      for (const plan of recentPlans) {
        for (const item of plan.items) {
          if (item.meal) {
            recentMealTitles.push(item.meal.title);
            recentMealIds.push(item.meal.id);
          }
        }
      }

      // Fetch recent cookbook logs
      const recentCooked = await this.prisma.cookbookLog.findMany({
        where: { userId },
        orderBy: { cookedAt: "desc" },
        take: 10,
        include: { meal: true },
      });

      for (const log of recentCooked) {
        if (log.meal) {
          recentMealTitles.push(log.meal.title);
          recentMealIds.push(log.meal.id);
        }
      }
    }

    // 2. Consolidate filters & preferences
    const dietaryTagsFromDto = dto.dietaryTags
      ? dto.dietaryTags.split(",").map((t: string) => t.trim().toUpperCase())
      : [];
    const dietaryRestrictionsList = Array.from(
      new Set([
        ...(dto.dietaryRestrictions || []),
        ...dietaryTagsFromDto,
        ...(user?.dietaryRestrictions || []),
      ]),
    ).map((t: string) => t.toUpperCase());

    const cuisinePref =
      dto.cuisine || user?.cuisinePreferences?.[0] || undefined;
    const mealVibes = dto.mealVibes || user?.mealVibes || [];
    const kitchenEquipment =
      dto.kitchenEquipment || user?.kitchenEquipment || [];
    const currency = user?.currency || "USD";

    // 3. Try AI Generation via OpenAI if available
    if (this.openAiService.isAvailable()) {
      try {
        const aiRecommendations =
          await this.openAiService.generateFoodRecommendations({
            user: user
              ? {
                  id: user.id,
                  weeklyBudget: user.weeklyBudget,
                  adultsCount: user.adultsCount,
                  childrenCount: user.childrenCount,
                  dietaryRestrictions: dietaryRestrictionsList,
                  cuisinePreferences: user.cuisinePreferences,
                  kitchenEquipment,
                  pantryStaples: user.pantryStaples,
                  mealVibes,
                  preferredStoreType: user.preferredStoreType,
                  currency,
                  country: user.country,
                  city: user.city,
                }
              : undefined,
            mealType: dto.mealType,
            cuisine: cuisinePref,
            dietaryRestrictions: dietaryRestrictionsList,
            maxPrepTime: dto.maxPrepTime,
            maxCost: dto.maxCost,
            mealVibes,
            kitchenEquipment,
            pantryItems: pantryItems.map((p) => ({
              ingredientName: p.ingredientName,
              category: p.category,
              quantity: p.quantity,
              unit: p.unit,
            })),
            recentMealTitles: Array.from(new Set(recentMealTitles)).slice(
              0,
              15,
            ),
            customPrompt: dto.customPrompt,
            count: targetCount,
            currency,
          });

        // Persist AI-generated meals to catalog with calculated calories & macros
        const persistedMeals = await Promise.all(
          aiRecommendations.map(async (aiMeal) => {
            const mealRecord = await this.findOrCreateMeal(aiMeal);
            const formatted = this.formatMealWithNutrition(mealRecord);
            return {
              ...formatted,
              whyRecommended:
                aiMeal.whyRecommended ||
                `Personalized ${aiMeal.cuisine} recommendation`,
              calories: Number(aiMeal.calories) || formatted.calories,
              caloriesPerServing: Number(aiMeal.calories) || formatted.calories,
              caloriesPerAdult: Number(aiMeal.calories) || formatted.calories,
              proteinGrams: aiMeal.proteinGrams ?? formatted.proteinGrams,
              carbsGrams: aiMeal.carbsGrams ?? formatted.carbsGrams,
              fatGrams: aiMeal.fatGrams ?? formatted.fatGrams,
            };
          }),
        );

        return {
          source: "AI_OPENAI",
          count: persistedMeals.length,
          data: persistedMeals,
        };
      } catch (error: any) {
        this.logger.warn(
          `AI food recommendation generation encountered an issue (${error.message}). Falling back to catalog engine.`,
        );
      }
    }

    // 4. Fallback / Catalog Recommendation Engine
    const excludedIds = new Set([
      ...(dto.excludeMealIds || []),
      ...recentMealIds,
    ]);

    const where: any = {};
    if (dietaryRestrictionsList.length > 0) {
      where.dietaryTags = { hasSome: dietaryRestrictionsList };
    }

    if (dto.mealType) {
      where.mealType = { equals: dto.mealType, mode: "insensitive" };
    }

    if (dto.maxPrepTime) {
      where.prepTimeMinutes = { lte: Number(dto.maxPrepTime) };
    }

    if (dto.maxCost) {
      where.estimatedCost = { lte: Number(dto.maxCost) };
    }

    let candidateMeals = await this.prisma.meal.findMany({
      where,
    });

    // If strictly filtered candidates are too few, relax non-dietary restrictions
    if (
      candidateMeals.length < targetCount &&
      dietaryRestrictionsList.length > 0
    ) {
      candidateMeals = await this.prisma.meal.findMany({
        where: {
          dietaryTags: { hasSome: dietaryRestrictionsList },
        },
      });
    }

    // If still empty, grab all available meals
    if (candidateMeals.length === 0) {
      candidateMeals = await this.prisma.meal.findMany({ take: 50 });
    }

    // Smart scoring & diversity shuffle
    const pantryNames = new Set(
      pantryItems.map((p) => p.ingredientName.toLowerCase().trim()),
    );

    const scoredMeals = candidateMeals.map((meal) => {
      let score = 0;

      // Anti-repetition penalty
      if (excludedIds.has(meal.id)) {
        score -= 10;
      }

      // Cuisine match bonus
      if (
        cuisinePref &&
        meal.cuisine.toLowerCase() === cuisinePref.toLowerCase()
      ) {
        score += 5;
      } else if (
        user?.cuisinePreferences?.some(
          (c: string) => c.toLowerCase() === meal.cuisine.toLowerCase(),
        )
      ) {
        score += 3;
      }

      // Pantry overlap bonus
      if (Array.isArray(meal.ingredients)) {
        for (const ing of meal.ingredients as any[]) {
          if (
            ing &&
            typeof ing.name === "string" &&
            pantryNames.has(ing.name.toLowerCase().trim())
          ) {
            score += 2;
          }
        }
      }

      // Add small random noise for diversity across consecutive requests
      const jitter = Math.random() * 2.5;
      return { meal, score: score + jitter };
    });

    // Sort descending by score
    scoredMeals.sort((a, b) => b.score - a.score);

    const resultMeals = scoredMeals.slice(0, targetCount).map(({ meal }) => {
      const formatted = this.formatMealWithNutrition(meal);
      return {
        ...formatted,
        whyRecommended: `Crafted for you based on ${meal.cuisine} flavor profile and dietary preferences.`,
      };
    });

    return {
      source: "CATALOG_PERSONALIZED",
      count: resultMeals.length,
      data: resultMeals,
    };
  }

  /**
   * Helper to persist AI-generated recipes into master catalog with calculated nutrition.
   */
  async findOrCreateMeal(
    aiMeal:
      | AiRecommendedMeal
      | {
          title: string;
          description?: string;
          prepTimeMinutes: number;
          servings: number;
          estimatedCost: number;
          calories?: number;
          proteinGrams?: number;
          carbsGrams?: number;
          fatGrams?: number;
          cuisine: string;
          mealType?: string;
          dietaryTags: string[];
          instructions: string[];
          ingredients: any[];
        },
  ) {
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

    // Estimate nutrition from ingredients and servings
    const nutrition = this.nutritionService.calculateMealNutrition({
      title: aiMeal.title,
      mealType: aiMeal.mealType,
      cuisine: aiMeal.cuisine,
      servings: aiMeal.servings,
      ingredients: aiMeal.ingredients,
      dietaryTags: aiMeal.dietaryTags,
    });

    const calories = Number(aiMeal.calories) || nutrition.calories;
    const proteinGrams =
      aiMeal.proteinGrams !== undefined
        ? Number(aiMeal.proteinGrams)
        : nutrition.proteinGrams;
    const carbsGrams =
      aiMeal.carbsGrams !== undefined
        ? Number(aiMeal.carbsGrams)
        : nutrition.carbsGrams;
    const fatGrams =
      aiMeal.fatGrams !== undefined
        ? Number(aiMeal.fatGrams)
        : nutrition.fatGrams;

    return this.prisma.meal.create({
      data: {
        title: aiMeal.title.trim(),
        description: aiMeal.description || null,
        prepTimeMinutes: Number(aiMeal.prepTimeMinutes) || 20,
        servings: Number(aiMeal.servings) || 2,
        estimatedCost: Number(aiMeal.estimatedCost) || 12.0,
        calories,
        proteinGrams,
        carbsGrams,
        fatGrams,
        cuisine: aiMeal.cuisine || "American",
        mealType: aiMeal.mealType || "Dinner",
        dietaryTags: Array.isArray(aiMeal.dietaryTags)
          ? aiMeal.dietaryTags
          : [],
        instructions: Array.isArray(aiMeal.instructions)
          ? aiMeal.instructions
          : [],
        ingredients: Array.isArray(aiMeal.ingredients)
          ? (aiMeal.ingredients as any)
          : [],
        status: "Active",
      },
    });
  }
}

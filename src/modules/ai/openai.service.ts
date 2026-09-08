import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

export interface AiPlanIngredient {
  name: string;
  quantity: string;
  category?: string;
  estimatedPrice?: number;
}

export interface AiPlanMeal {
  dayOfWeek: number;
  mealType: string;
  title: string;
  description?: string;
  prepTimeMinutes: number;
  servings: number;
  estimatedCost: number;
  cuisine: string;
  dietaryTags: string[];
  instructions: string[];
  ingredients: AiPlanIngredient[];
}

export interface AiGeneratedPlanResult {
  planTitle?: string;
  planOverview?: string;
  currency?: string;
  totalEstimatedCost: number;
  dailyTargetCalories?: number;
  meals: AiPlanMeal[];
}

export interface AiRecommendedMeal {
  title: string;
  description?: string;
  mealType: string;
  prepTimeMinutes: number;
  servings: number;
  estimatedCost: number;
  cuisine: string;
  dietaryTags: string[];
  instructions: string[];
  ingredients: AiPlanIngredient[];
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  whyRecommended?: string;
}

export interface PricingCalibration {
  factor: number;
  sampleCount: number;
  averageDelta?: number;
  message?: string;
}

export interface StoreModifier {
  storeType: string;
  storeMultiplier: number;
  currency: string;
  country?: string;
  city?: string;
}

export interface GeneratePlanOptions {
  user: {
    id: string;
    weeklyBudget: number;
    adultsCount: number;
    childrenCount: number;
    dietaryRestrictions: string[];
    cuisinePreferences: string[];
    kitchenEquipment: string[];
    pantryStaples: string[];
    mealVibes: string[];
    plannedMealTypes: string[];
    plannedDaysCount: number;
    mealFrequency?: {
      breakfast: number;
      lunch: number;
      dinner: number;
    };
    preferredStoreType?: string;
    currency?: string;
    country?: string | null;
    city?: string | null;
    measurementSystem?: string;
  };
  pantryItems?: Array<{
    ingredientName: string;
    category: string;
    quantity: number;
    unit: string;
  }>;
  overrides?: {
    daysCount?: number;
    mealTypes?: string[];
    mealFrequency?: {
      breakfast: number;
      lunch: number;
      dinner: number;
    };
    mealSlots?: Array<{
      dayOfWeek: number;
      mealType: string;
    }>;
    weeklyBudget?: number;
    adultsCount?: number;
    childrenCount?: number;
    dietaryRestrictions?: string[];
    cuisinePreferences?: string[];
    kitchenEquipment?: string[];
    pantryStaples?: string[];
    mealVibes?: string[];
    includePantryItems?: boolean;
    customNotes?: string;
    recentMealTitles?: string[];
    preferredStoreType?: string;
    currency?: string;
    country?: string;
    city?: string;
    measurementSystem?: string;
  };
  pricingCalibration?: PricingCalibration;
  storeModifier?: StoreModifier;
}

export interface GenerateRecommendationsOptions {
  user?: {
    id?: string;
    weeklyBudget?: number;
    adultsCount?: number;
    childrenCount?: number;
    dietaryRestrictions?: string[];
    cuisinePreferences?: string[];
    kitchenEquipment?: string[];
    pantryStaples?: string[];
    mealVibes?: string[];
    preferredStoreType?: string;
    currency?: string;
    country?: string | null;
    city?: string | null;
    measurementSystem?: string;
  };
  measurementSystem?: string;
  mealType?: string;
  cuisine?: string;
  dietaryRestrictions?: string[];
  maxPrepTime?: number;
  maxCost?: number;
  mealVibes?: string[];
  kitchenEquipment?: string[];
  pantryItems?: Array<{
    ingredientName: string;
    category?: string;
    quantity?: number;
    unit?: string;
  }>;
  recentMealTitles?: string[];
  customPrompt?: string;
  count?: number;
  currency?: string;
  storeModifier?: StoreModifier;
}

/** A single meal the plan has to fill: one meal type on one day. */
type PlanSlot = { dayOfWeek: number; mealType: string };

/** Meal types a generated meal can be matched to a slot by. */
const ALIGNABLE_MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER"];

function normalizeMealType(mealType?: string): string {
  return (mealType || "").trim().toUpperCase();
}

function countSlotsByType(slots: PlanSlot[]): {
  breakfast: number;
  lunch: number;
  dinner: number;
} {
  const counts = { breakfast: 0, lunch: 0, dinner: 0 };

  for (const slot of slots) {
    switch (normalizeMealType(slot.mealType)) {
      case "BREAKFAST":
        counts.breakfast += 1;
        break;
      case "LUNCH":
        counts.lunch += 1;
        break;
      case "DINNER":
        counts.dinner += 1;
        break;
    }
  }

  return counts;
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private openai: OpenAI | null = null;
  private model: string;
  private readonly maxMealsPerRequest: number;
  private readonly maxParallelRequests: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>("CHATGPT_OPENAI_KEY") ||
      this.configService.get<string>("OPENAI_API_KEY");

    this.model =
      this.configService.get<string>("OPENAI_MODEL") || "gpt-4o-mini";
    this.maxMealsPerRequest =
      this.configService.get<number>("OPENAI_MAX_MEALS_PER_REQUEST") ?? 7;
    this.maxParallelRequests =
      this.configService.get<number>("OPENAI_MAX_PARALLEL_REQUESTS") ?? 8;

    if (apiKey && apiKey.trim() !== "" && !apiKey.startsWith("your_")) {
      this.openai = new OpenAI({
        apiKey: apiKey.trim(),
        // Completion latency scales with requested meal count; without an explicit
        // ceiling the SDK would hold a request open for its 10 minute default.
        timeout:
          this.configService.get<number>("OPENAI_TIMEOUT_MS") ?? 120_000,
        maxRetries: this.configService.get<number>("OPENAI_MAX_RETRIES") ?? 2,
      });
      this.logger.log(`OpenAI Service initialized with model: ${this.model}`);
    } else {
      this.logger.warn(
        "OpenAI API key not configured or set to placeholder. AI generation will use fallback mode.",
      );
    }
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Generates a weekly AI meal plan with high variety, balanced nutrition, and anti-repetition rules.
   *
   * Completion latency is dominated by the number of meals a single request has to write out,
   * so large plans are split into independent segments (grouped by meal type, then capped at
   * `OPENAI_MAX_MEALS_PER_REQUEST` slots) and generated concurrently. Plans small enough to fit
   * in one segment are sent as a single request, unchanged.
   */
  async generateMealPlan(
    options: GeneratePlanOptions,
  ): Promise<AiGeneratedPlanResult> {
    if (!this.openai) {
      throw new Error("OpenAI client is not configured.");
    }

    const mealSlots = options.overrides?.mealSlots ?? [];
    const groups = this.groupSlotsIntoSegments(mealSlots);

    let plan: AiGeneratedPlanResult;

    if (groups.length <= 1) {
      plan = await this.generatePlanSegment(options);
    } else {
      const segments = this.buildSegmentOptions(
        options,
        groups,
        mealSlots.length,
      );

      this.logger.log(
        `Splitting ${mealSlots.length}-meal plan into ${segments.length} parallel OpenAI requests (${segments.map((s) => s.label).join(", ")}), max ${this.maxParallelRequests} concurrent...`,
      );

      const results = await this.runWithConcurrency(segments, (segment) =>
        this.generatePlanSegment(segment.options),
      );

      plan = this.mergeSegmentResults(results);
    }

    return this.backfillMissingMeals(options, plan);
  }

  /**
   * Batches slots into one request per meal type, split again so that no single request
   * has to write out more than `OPENAI_MAX_MEALS_PER_REQUEST` meals.
   *
   * Slot assignments are what let a segment know exactly which meals to produce, so a plan
   * without them — or one small enough to fit a single request — yields at most one batch
   * and takes the unsplit path.
   */
  private groupSlotsIntoSegments(slots: PlanSlot[]): PlanSlot[][] {
    const chunkSize = Math.max(1, this.maxMealsPerRequest);

    if (slots.length === 0) {
      return [];
    }
    if (slots.length <= chunkSize) {
      return [slots];
    }

    const slotsByType = new Map<string, PlanSlot[]>();
    for (const slot of slots) {
      const key = normalizeMealType(slot.mealType);
      const bucket = slotsByType.get(key);
      if (bucket) {
        bucket.push(slot);
      } else {
        slotsByType.set(key, [slot]);
      }
    }

    const groups: PlanSlot[][] = [];
    for (const typeSlots of slotsByType.values()) {
      for (let i = 0; i < typeSlots.length; i += chunkSize) {
        groups.push(typeSlots.slice(i, i + chunkSize));
      }
    }

    return groups;
  }

  /**
   * Expands each slot batch into a self-contained request: its own slot schedule, per-type
   * frequency, proportional share of the budget, and whole-plan context for the fields that
   * describe the plan as a whole.
   */
  private buildSegmentOptions(
    options: GeneratePlanOptions,
    groups: PlanSlot[][],
    totalMeals: number,
  ): Array<{ label: string; options: GeneratePlanOptions }> {
    const overrides = options.overrides ?? {};
    const weeklyBudget =
      overrides.weeklyBudget || options.user.weeklyBudget || 150.0;
    const fullFrequency = overrides.mealFrequency ||
      options.user.mealFrequency || { breakfast: 0, lunch: 0, dinner: 0 };
    const daysCount = overrides.daysCount || options.user.plannedDaysCount || 7;
    const currency =
      options.storeModifier?.currency ||
      overrides.currency ||
      options.user.currency ||
      "USD";

    return groups.map((slots, index) => {
      const frequency = countSlotsByType(slots);
      const mealTypes = Array.from(
        new Set(slots.map((slot) => normalizeMealType(slot.mealType))),
      );
      // Proportional share of the overall budget so segment costs sum back to the target.
      const segmentBudget =
        Math.round(
          ((weeklyBudget * slots.length) / Math.max(totalMeals, 1)) * 100,
        ) / 100;

      return {
        label: `${mealTypes.join("/")}x${slots.length}`,
        options: {
          ...options,
          overrides: {
            ...overrides,
            mealSlots: slots,
            mealFrequency: frequency,
            mealTypes,
            weeklyBudget: Math.max(segmentBudget, 1),
            customNotes: this.buildSegmentNotes({
              segmentIndex: index,
              segmentCount: groups.length,
              segmentMeals: slots.length,
              mealTypes,
              totalMeals,
              fullFrequency,
              daysCount,
              currency,
              weeklyBudget,
              segmentBudget,
              userNotes: overrides.customNotes,
            }),
          },
        },
      };
    });
  }

  /**
   * Re-requests only the meals the model failed to produce.
   *
   * The model occasionally returns fewer meals than asked for. Callers align generated meals
   * onto concrete slots and reject the whole plan when any meal type comes up short, so a
   * single missing meal would otherwise throw away an entire generation and silently
   * downgrade the plan to catalog matching. Filling just the gaps costs one short request.
   */
  private async backfillMissingMeals(
    options: GeneratePlanOptions,
    plan: AiGeneratedPlanResult,
  ): Promise<AiGeneratedPlanResult> {
    const mealSlots = options.overrides?.mealSlots ?? [];
    const unfilled = this.findUnfilledSlots(mealSlots, plan);

    if (unfilled.length === 0) {
      return plan;
    }

    const missing = countSlotsByType(unfilled);
    this.logger.warn(
      `OpenAI returned ${plan.meals?.length ?? 0} of ${mealSlots.length} requested meals; re-requesting ${unfilled.length} unfilled slot(s) (${missing.breakfast} breakfast, ${missing.lunch} lunch, ${missing.dinner} dinner)...`,
    );

    const segments = this.buildSegmentOptions(
      options,
      this.groupSlotsIntoSegments(unfilled),
      mealSlots.length,
    );
    const results = await this.runWithConcurrency(segments, (segment) =>
      this.generatePlanSegment(segment.options),
    );

    return this.mergeSegmentResults([plan, ...results]);
  }

  /**
   * Determines which requested slots the generated meals cannot cover, mirroring how the
   * caller assigns meals to slots: meals of a matching type first, then any meal whose type
   * falls outside breakfast/lunch/dinner as a wildcard.
   */
  private findUnfilledSlots(
    mealSlots: PlanSlot[],
    plan: AiGeneratedPlanResult,
  ): PlanSlot[] {
    if (mealSlots.length === 0) {
      return [];
    }

    const generatedByType = new Map<string, number>();
    let wildcards = 0;
    for (const meal of plan.meals ?? []) {
      const key = normalizeMealType(meal.mealType);
      if (ALIGNABLE_MEAL_TYPES.includes(key)) {
        generatedByType.set(key, (generatedByType.get(key) ?? 0) + 1);
      } else {
        wildcards += 1;
      }
    }

    const slotsByType = new Map<string, PlanSlot[]>();
    for (const slot of mealSlots) {
      const key = normalizeMealType(slot.mealType);
      const bucket = slotsByType.get(key);
      if (bucket) {
        bucket.push(slot);
      } else {
        slotsByType.set(key, [slot]);
      }
    }

    const unfilled: PlanSlot[] = [];
    for (const [key, slots] of slotsByType) {
      let shortfall = slots.length - (generatedByType.get(key) ?? 0);
      if (shortfall <= 0) {
        continue;
      }

      const coveredByWildcards = Math.min(wildcards, shortfall);
      wildcards -= coveredByWildcards;
      shortfall -= coveredByWildcards;

      if (shortfall > 0) {
        unfilled.push(...slots.slice(slots.length - shortfall));
      }
    }

    return unfilled;
  }

  /**
   * Gives a segment enough whole-plan context to emit plan-level fields (title, overview,
   * daily calories) that describe the complete week rather than just its own slice.
   */
  private buildSegmentNotes(params: {
    segmentIndex: number;
    segmentCount: number;
    segmentMeals: number;
    mealTypes: string[];
    totalMeals: number;
    fullFrequency: { breakfast: number; lunch: number; dinner: number };
    daysCount: number;
    currency: string;
    weeklyBudget: number;
    segmentBudget: number;
    userNotes?: string;
  }): string {
    const {
      segmentIndex,
      segmentCount,
      segmentMeals,
      mealTypes,
      totalMeals,
      fullFrequency,
      daysCount,
      currency,
      weeklyBudget,
      segmentBudget,
      userNotes,
    } = params;

    const segmentNote = `SEGMENTED GENERATION CONTEXT (internal orchestration detail):
- You are producing segment ${segmentIndex + 1} of ${segmentCount} of ONE single weekly meal plan.
- The COMPLETE plan covers ${totalMeals} meals across ${daysCount} day(s): ${fullFrequency.breakfast} breakfast, ${fullFrequency.lunch} lunch, ${fullFrequency.dinner} dinner, with an overall budget of ${currency} ${weeklyBudget.toFixed(2)}.
- YOUR segment must output EXACTLY the ${segmentMeals} ${mealTypes.join("/")} meal(s) listed in the slot schedule above and nothing else.
- "totalEstimatedCost" must cover ONLY your ${segmentMeals} meal(s) and should approximate ${currency} ${segmentBudget.toFixed(2)} (this segment's proportional share).
- "planTitle" and "planOverview" must describe the COMPLETE weekly plan across all meal types, not just your segment.
- "dailyTargetCalories" must reflect a FULL day of eating for the household across all meal types, not just your segment.
- Sibling segments cover the other days and meal types of the same week. Choose distinctive, clearly differentiated recipes for the specific days you were assigned so that no recipe title or core concept can collide with another segment.`;

    return userNotes && userNotes.trim().length > 0
      ? `${userNotes.trim()}\n\n${segmentNote}`
      : segmentNote;
  }

  /**
   * Recombines segment responses into the single plan shape the caller expects.
   */
  private mergeSegmentResults(
    results: AiGeneratedPlanResult[],
  ): AiGeneratedPlanResult {
    const meals = results.flatMap((r) => r.meals ?? []);
    const summedCost = results.reduce(
      (acc, r) => acc + (Number(r.totalEstimatedCost) || 0),
      0,
    );
    const dailyCalories = results
      .map((r) => Number(r.dailyTargetCalories))
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      planTitle: results.find((r) => r.planTitle?.trim())?.planTitle,
      planOverview: results.find((r) => r.planOverview?.trim())?.planOverview,
      currency: results.find((r) => r.currency)?.currency,
      // Segments each report a whole-day target; the largest is the best whole-day estimate.
      dailyTargetCalories:
        dailyCalories.length > 0 ? Math.max(...dailyCalories) : undefined,
      totalEstimatedCost:
        summedCost > 0
          ? Math.round(summedCost * 100) / 100
          : meals.reduce((acc, m) => acc + (Number(m.estimatedCost) || 0), 0),
      meals,
    };
  }

  /**
   * Runs tasks in parallel with a bounded number of in-flight requests, preserving input order.
   */
  private async runWithConcurrency<T, R>(
    items: T[],
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const limit = Math.max(1, Math.min(this.maxParallelRequests, items.length));
    const results = new Array<R>(items.length);
    let cursor = 0;

    const runners = Array.from({ length: limit }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) {
          return;
        }
        results[index] = await worker(items[index], index);
      }
    });

    await Promise.all(runners);
    return results;
  }

  private async generatePlanSegment(
    options: GeneratePlanOptions,
  ): Promise<AiGeneratedPlanResult> {
    if (!this.openai) {
      throw new Error("OpenAI client is not configured.");
    }

    const {
      user,
      pantryItems = [],
      overrides = {},
      pricingCalibration,
      storeModifier,
    } = options;

    const mealFrequency = overrides.mealFrequency ||
      user.mealFrequency || {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
      };
    const mealSlots =
      overrides.mealSlots && overrides.mealSlots.length > 0
        ? overrides.mealSlots
        : [];
    const daysCount =
      overrides.daysCount ||
      user.plannedDaysCount ||
      Math.max(
        mealFrequency.breakfast,
        mealFrequency.lunch,
        mealFrequency.dinner,
        7,
      );
    const mealTypes =
      overrides.mealTypes && overrides.mealTypes.length > 0
        ? overrides.mealTypes
        : user.plannedMealTypes.length > 0
          ? user.plannedMealTypes
          : ["BREAKFAST", "LUNCH", "DINNER"];
    const totalMealsRequired =
      mealSlots.length > 0
        ? mealSlots.length
        : mealFrequency.breakfast + mealFrequency.lunch + mealFrequency.dinner;
    const weeklyBudget = overrides.weeklyBudget || user.weeklyBudget || 150.0;
    const dietaryRestrictions =
      overrides.dietaryRestrictions || user.dietaryRestrictions || [];
    const cuisinePreferences =
      overrides.cuisinePreferences || user.cuisinePreferences || [];
    const mealVibes = overrides.mealVibes || user.mealVibes || [];
    const adultsCount =
      overrides.adultsCount !== undefined
        ? overrides.adultsCount
        : user.adultsCount || 1;
    const childrenCount =
      overrides.childrenCount !== undefined
        ? overrides.childrenCount
        : user.childrenCount || 0;
    const kitchenEquipment =
      overrides.kitchenEquipment || user.kitchenEquipment || [];
    const pantryStaples = overrides.pantryStaples || user.pantryStaples || [];
    const recentMealTitles = overrides.recentMealTitles || [];
    const totalServings = Math.max(1, adultsCount + childrenCount);

    const currency =
      storeModifier?.currency || overrides.currency || user.currency || "USD";
    const storeType =
      storeModifier?.storeType ||
      overrides.preferredStoreType ||
      user.preferredStoreType ||
      "STANDARD";
    const storeMultiplier = storeModifier?.storeMultiplier || 1.0;
    const location =
      [overrides.city || user.city, overrides.country || user.country]
        .filter(Boolean)
        .join(", ") || "Standard Metro Area";

    const pantryStockText =
      overrides.includePantryItems !== false && pantryItems.length > 0
        ? pantryItems
            .map(
              (p) =>
                `- ${p.ingredientName} (${p.quantity} ${p.unit}, category: ${p.category})`,
            )
            .join("\n")
        : "None provided";

    const recentMealsText =
      recentMealTitles.length > 0
        ? recentMealTitles.map((t) => `- ${t}`).join("\n")
        : "None (no recent duplicate history)";

    // Pricing calibration context instructions
    let calibrationPromptSection = "";
    if (pricingCalibration && pricingCalibration.sampleCount > 0) {
      const deltaPercent = Math.round((pricingCalibration.factor - 1) * 100);
      const direction =
        deltaPercent >= 0
          ? `+${deltaPercent}% higher`
          : `${deltaPercent}% lower`;
      calibrationPromptSection = `
- HISTORICAL RECEIPT CALIBRATION:
  Based on ${pricingCalibration.sampleCount} previous logged supermarket receipts, this user's actual spending averages ${direction} than standard baselines (calibration factor: ${pricingCalibration.factor.toFixed(2)}x).
  Adjust individual recipe price estimates by ${pricingCalibration.factor.toFixed(2)}x to ensure total cost accuracy matches their actual store checkout.`;
    }

    const measurementSystem =
      overrides.measurementSystem ||
      user.measurementSystem ||
      ((overrides.country || user.country || "")
        .toLowerCase()
        .includes("united states") ||
      (overrides.country || user.country || "").toLowerCase() === "us"
        ? "IMPERIAL"
        : "METRIC");

    // Regional & Store modifier context instructions
    const storePromptSection = `
- REGIONAL & STORE MODIFIERS:
  * Target Currency: ${currency}
  * Location: ${location}
  * Measurement System: ${measurementSystem} (Use ${
    measurementSystem === "IMPERIAL"
      ? "Imperial units like lbs, oz, cups, fl oz, tbsp, tsp"
      : "Metric units like grams (g), kg, ml, liters (L), tbsp, tsp"
  } for all ingredient quantities)
  * Supermarket Tier/Chain: ${storeType} (Price Index Multiplier: ${storeMultiplier.toFixed(2)}x)
  * Price accordingly: Discount stores (e.g. Aldi/Lidl ~0.82x), Standard stores (e.g. Kroger/Tesco ~1.0x), Premium stores (e.g. Whole Foods/M&S ~1.30x).`;

    const slotScheduleText =
      mealSlots.length > 0
        ? mealSlots
            .map(
              (slot, index) =>
                `${index + 1}. Day ${slot.dayOfWeek}, ${slot.mealType}`,
            )
            .join("\n")
        : "Not pre-assigned; distribute across the planning period.";

    const systemPrompt = `You are a world-class professional culinary planner, certified nutritionist, and budget-optimization expert for a smart meal management platform.
Your task is to create an inspiring, diverse, nutritionally balanced, and budget-optimized weekly meal plan formatted strictly as JSON.

Follow these strict rules:
1. Planning period spans ${daysCount} day(s) (Day 1 through Day ${daysCount}).
2. Generate EXACTLY the requested number of meals per meal type:
   - Breakfast meals required: ${mealFrequency.breakfast}
   - Lunch meals required: ${mealFrequency.lunch}
   - Dinner meals required: ${mealFrequency.dinner}
   - TOTAL meals required: ${totalMealsRequired}
3. Do NOT generate extra meals beyond the required counts for each meal type.
4. Do NOT generate meals for meal types with a required count of 0.
5. Assign each meal to an appropriate dayOfWeek (1-${daysCount}) and matching mealType.
6. When slot assignments are provided below, follow them exactly for dayOfWeek and mealType.
7. Scale all recipes and ingredient quantities for ${totalServings} person(s) (${adultsCount} adult(s), ${childrenCount} child(ren)).
8. Ensure the estimated total cost across all meals approximates the target weekly budget of ${currency} ${weeklyBudget.toFixed(2)}. Assign realistic individual meal costs in ${currency}.
9. STRICT DIETARY ADHERENCE: Strictly adhere to all dietary restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(", ") : "None"}. Never include prohibited ingredients.
10. CUISINE DIVERSITY & BALANCE: Cater to cuisine preferences (${cuisinePreferences.length > 0 ? cuisinePreferences.join(", ") : "Versatile/International"}) while offering exciting culinary variety.
11. ABSOLUTE PLAN-WIDE VARIETY & ZERO REPETITION:
    - Every single meal across all ${daysCount} days MUST be a distinct, non-repeated recipe with a unique title and unique flavor profile.
    - NEVER repeat the same breakfast, lunch, or dinner across different days (e.g. Day 1 Breakfast != Day 2 Breakfast != Day 3 Breakfast; Day 1 Dinner != Day 2 Dinner != Day 3 Dinner).
    - If ${totalMealsRequired} total meals are requested, output exactly ${totalMealsRequired} completely different, creative recipes.
12. PROTEIN & BASE DIVERSIFICATION: Rotate hero protein and starch bases across consecutive days (e.g. Day 1 Salmon/Fish, Day 2 Chicken/Poultry, Day 3 Chickpeas/Legumes, Day 4 Lean Beef/Turkey, Day 5 Tofu/Tempeh, Day 6 Eggs/Halloumi, Day 7 Vegetarian Grains).
13. SLOT APPROPRIATENESS:
    - BREAKFAST: Varied morning items (e.g., savory sweet potato hashes, shakshuka, chia seed pudding, smoothie bowls, vegetable frittatas, protein oat pancakes, baked oatmeal).
    - LUNCH: Varied midday items (e.g., vibrant quinoa grain bowls, gourmet pita wraps, nourishing soups, Mediterranean salads, Asian sesame soba bowls).
    - DINNER: Varied evening centerpieces (e.g., sheet pan salmon traybakes, coconut vegetable curries, skillet lemon-herb pasta, roasted platters, braised dishes, wok stir-fries).
14. RECENT HISTORY NON-REPETITION: Do NOT repeat any of these recently cooked/planned meals:
${recentMealsText}
15. Take advantage of available kitchen equipment: ${kitchenEquipment.length > 0 ? kitchenEquipment.join(", ") : "Standard kitchen"}.
16. Prioritize and reuse ingredients already in the user's pantry/stock to reduce grocery costs and food waste:
${pantryStockText}
17. Respect preferred meal vibes: ${mealVibes.length > 0 ? mealVibes.join(", ") : "Balanced & wholesome"}.
18. Apply pricing models:
${storePromptSection}
${calibrationPromptSection}
19. Output ONLY valid JSON according to the schema provided below. Do not wrap in markdown quotes or add conversational filler.`;

    const userPrompt = `Create the weekly meal plan with the following specifications:
- Planning Days: ${daysCount}
- Breakfast meals required: ${mealFrequency.breakfast}
- Lunch meals required: ${mealFrequency.lunch}
- Dinner meals required: ${mealFrequency.dinner}
- Total meals required: ${totalMealsRequired}
- Meal slot schedule:
${slotScheduleText}
- Target Weekly Budget: ${currency} ${weeklyBudget.toFixed(2)}
- Currency: ${currency}
- Store Tier: ${storeType} (${storeMultiplier.toFixed(2)}x)
- Location: ${location}
- Household: ${adultsCount} adults, ${childrenCount} children (Total servings: ${totalServings})
- Dietary Restrictions: ${dietaryRestrictions.join(", ") || "None"}
- Cuisine Preferences: ${cuisinePreferences.join(", ") || "Any diverse cuisines"}
- Preferred Vibes: ${mealVibes.join(", ") || "Fresh & balanced"}
- Pantry Staples: ${pantryStaples.join(", ") || "Standard pantry"}
- Special Custom Notes: ${overrides.customNotes || "None"}

Return ONLY a JSON object with this exact structure:
{
  "planTitle": "e.g., Vibrant Mediterranean & Asian Fusion Weekly Plan",
  "planOverview": "Brief summary of how the plan balances variety, nutrition, budget, and pantry ingredients",
  "currency": "${currency}",
  "totalEstimatedCost": 124.50,
  "dailyTargetCalories": 2000,
  "meals": [
    {
      "dayOfWeek": 1,
      "mealType": "DINNER",
      "title": "Recipe Title",
      "description": "Short appetizing description highlighting flavors and textures",
      "prepTimeMinutes": 25,
      "servings": ${totalServings},
      "estimatedCost": 4.50,
      "cuisine": "Mediterranean",
      "dietaryTags": ["HIGH_PROTEIN"],
      "instructions": ["Step 1...", "Step 2..."],
      "ingredients": [
        { "name": "Ingredient name", "quantity": "e.g. 200g or 2 tbsp", "category": "Produce" }
      ]
    }
  ]
}`;

    this.logger.log(
      `Calling OpenAI (${this.model}) to generate diverse ${totalMealsRequired}-meal plan (${mealFrequency.breakfast} breakfast, ${mealFrequency.lunch} lunch, ${mealFrequency.dinner} dinner) for user ${user.id} in ${currency}...`,
    );

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.85,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Received empty response from OpenAI");
    }

    try {
      const parsed: AiGeneratedPlanResult = JSON.parse(content);
      if (
        !parsed.meals ||
        !Array.isArray(parsed.meals) ||
        parsed.meals.length === 0
      ) {
        throw new Error("OpenAI response missing valid meals array");
      }

      parsed.currency = currency;

      // Calculate total cost if missing or zero
      if (!parsed.totalEstimatedCost || parsed.totalEstimatedCost <= 0) {
        parsed.totalEstimatedCost = parsed.meals.reduce(
          (acc, m) => acc + (Number(m.estimatedCost) || 0),
          0,
        );
      }

      this.logger.log(
        `OpenAI generated plan successfully: "${parsed.planTitle || "Meal Plan"}" with ${parsed.meals.length} meals in ${currency}.`,
      );
      return parsed;
    } catch (parseError: any) {
      this.logger.error(
        `Failed to parse OpenAI response: ${parseError.message}`,
        content,
      );
      throw new Error(`OpenAI response parsing failed: ${parseError.message}`);
    }
  }

  /**
   * Generates dynamic, diverse, personalized food recommendations / meal ideas.
   */
  async generateFoodRecommendations(
    options: GenerateRecommendationsOptions,
  ): Promise<AiRecommendedMeal[]> {
    if (!this.openai) {
      throw new Error("OpenAI client is not configured.");
    }

    const {
      user = {},
      mealType,
      cuisine,
      dietaryRestrictions = user.dietaryRestrictions || [],
      maxPrepTime,
      maxCost,
      mealVibes = user.mealVibes || [],
      kitchenEquipment = user.kitchenEquipment || [],
      pantryItems = [],
      recentMealTitles = [],
      customPrompt,
      count = 5,
      currency = user.currency || "USD",
      storeModifier,
    } = options;

    const adultsCount = user.adultsCount || 2;
    const childrenCount = user.childrenCount || 0;
    const totalServings = Math.max(1, adultsCount + childrenCount);
    const cuisinePref =
      cuisine ||
      (user.cuisinePreferences && user.cuisinePreferences.length > 0
        ? user.cuisinePreferences.join(", ")
        : "Diverse Global Cuisines");

    const pantryText =
      pantryItems.length > 0
        ? pantryItems
            .map(
              (p) =>
                `- ${p.ingredientName} (${p.quantity || 1} ${p.unit || "pcs"})`,
            )
            .join("\n")
        : "None specified";

    const recentMealsText =
      recentMealTitles.length > 0
        ? recentMealTitles.map((t) => `- ${t}`).join("\n")
        : "None";

    const systemPrompt = `You are an elite culinary expert, nutritionist, and personal chef for a smart meal management application.
Your goal is to generate ${count} distinct, creative, healthy, and enticing meal recommendations dynamically tailored to the user's specific dietary matrix and preferences.

Strict Rules:
1. Generate EXACTLY ${count} unique, high-quality meal recommendations.
2. DIVERSITY & CREATIVITY: Ensure broad variety across recipes. Each recommendation must feature a distinct protein source, cooking technique, and flavor profile.
3. STRICT DIETARY ENFORCEMENT: Strictly honor dietary restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(", ") : "None"}. Never include conflicting ingredients.
4. SLOT CONTEXT: ${mealType ? `All meals must be tailored for ${mealType.toUpperCase()}` : "Provide versatile options suitable for breakfast, lunch, or dinner as appropriate"}.
5. BUDGET & PREP LIMITS:
   ${maxPrepTime ? `- Max prep time: ${maxPrepTime} minutes` : ""}
   ${maxCost ? `- Target estimated cost per meal: <= ${currency} ${maxCost}` : ""}
6. AVOID REPETITION: Explicitly avoid recommending recipes similar to these recent meals:
${recentMealsText}
7. PANTRY INTEGRATION: Strategically utilize available pantry stock where relevant to minimize waste:
${pantryText}
8. Provide estimated macro nutrients (calories, protein, carbs, fat) and a brief appetizing "whyRecommended" explanation for each meal.
9. Output ONLY valid JSON according to the schema provided below.`;

    const userPrompt = `Generate ${count} personalized meal recommendations with the following parameters:
- Target Meal Type: ${mealType || "Any (Breakfast, Lunch, or Dinner)"}
- Cuisine Preference / Style: ${cuisinePref}
- Dietary Restrictions: ${dietaryRestrictions.join(", ") || "None"}
- Preferred Vibes: ${mealVibes.join(", ") || "Fresh, vibrant, and delicious"}
- Kitchen Equipment Available: ${kitchenEquipment.join(", ") || "Standard kitchen"}
- Household Servings: ${totalServings} (${adultsCount} adults, ${childrenCount} children)
- Currency: ${currency}
- Additional Custom Instructions: ${customPrompt || "None"}

Return ONLY a JSON object with this exact structure:
{
  "recommendations": [
    {
      "title": "Dish Title",
      "description": "Appetizing 1-2 sentence description",
      "mealType": "${mealType || "DINNER"}",
      "prepTimeMinutes": 20,
      "servings": ${totalServings},
      "estimatedCost": 6.50,
      "cuisine": "Mediterranean",
      "dietaryTags": ["HIGH_PROTEIN", "GLUTEN_FREE"],
      "calories": 480,
      "proteinGrams": 36,
      "carbsGrams": 42,
      "fatGrams": 18,
      "whyRecommended": "High protein, cooks in 20 mins, uses your in-stock olive oil and garlic",
      "instructions": ["Step 1...", "Step 2..."],
      "ingredients": [
        { "name": "Ingredient name", "quantity": "e.g. 200g", "category": "Produce" }
      ]
    }
  ]
}`;

    this.logger.log(
      `Calling OpenAI to generate ${count} personalized food recommendations (mealType: ${mealType || "ALL"}, cuisine: ${cuisinePref})...`,
    );

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.85,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Received empty response from OpenAI");
    }

    try {
      const parsed = JSON.parse(content);
      const meals: AiRecommendedMeal[] =
        parsed.recommendations || parsed.meals || [];
      if (!Array.isArray(meals) || meals.length === 0) {
        throw new Error(
          "OpenAI response did not contain a recommendations array",
        );
      }

      this.logger.log(
        `OpenAI successfully generated ${meals.length} meal recommendations.`,
      );
      return meals;
    } catch (err: any) {
      this.logger.error(
        `Failed to parse recommendations from OpenAI: ${err.message}`,
        content,
      );
      throw new Error(`OpenAI recommendations parsing failed: ${err.message}`);
    }
  }
}

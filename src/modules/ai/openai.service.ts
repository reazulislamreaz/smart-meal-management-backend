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
  };
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

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private openai: OpenAI | null = null;
  private model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>("CHATGPT_OPENAI_KEY") ||
      this.configService.get<string>("OPENAI_API_KEY");

    this.model =
      this.configService.get<string>("OPENAI_MODEL") || "gpt-4o-mini";

    if (apiKey && apiKey.trim() !== "" && !apiKey.startsWith("your_")) {
      this.openai = new OpenAI({ apiKey: apiKey.trim() });
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
   */
  async generateMealPlan(
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

    // Regional & Store modifier context instructions
    const storePromptSection = `
- REGIONAL & STORE MODIFIERS:
  * Target Currency: ${currency}
  * Location: ${location}
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
10. CUISINE DIVERSITY & BALANCE: Cater to cuisine preferences (${cuisinePreferences.length > 0 ? cuisinePreferences.join(", ") : "Versatile/International"}) while offering exciting culinary variety. Avoid repetitive meals.
11. PROTEIN & TEXTURE ROTATION: Rotate protein sources across the days (e.g., salmon/fish, poultry, legumes/lentils, tofu/tempeh, eggs, lean beef/turkey, halloumi) so consecutive meals never feel repetitive.
12. SLOT APPROPRIATENESS:
    - BREAKFAST: Wholesome morning items (e.g., savory hashes, shakshuka, chia seed pudding, smoothie bowls, frittatas, protein pancakes, baked oatmeal).
    - LUNCH: Convenient, energizing, or meal-prep friendly options (e.g., vibrant grain bowls, gourmet wraps, nourishing soups, Mediterranean or Asian noodle salads).
    - DINNER: Hearty, satisfying, and balanced culinary centerpieces (e.g., traybakes, curries, skillet pastas, roasted platters, braised dishes, stir-fries).
13. ANTI-REPETITION: Do NOT generate duplicate or nearly identical recipes across the plan. Also avoid repeating these recently cooked/planned meals:
${recentMealsText}
14. Take advantage of available kitchen equipment: ${kitchenEquipment.length > 0 ? kitchenEquipment.join(", ") : "Standard kitchen"}.
15. Prioritize and reuse ingredients already in the user's pantry/stock to reduce grocery costs and food waste:
${pantryStockText}
16. Respect preferred meal vibes: ${mealVibes.length > 0 ? mealVibes.join(", ") : "Balanced & wholesome"}.
17. Apply pricing models:
${storePromptSection}
${calibrationPromptSection}
18. Output ONLY valid JSON according to the schema provided below. Do not wrap in markdown quotes or add conversational filler.`;

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

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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
    preferredStoreType?: string;
    currency?: string;
    country?: string;
    city?: string;
  };
  pricingCalibration?: PricingCalibration;
  storeModifier?: StoreModifier;
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private openai: OpenAI | null = null;
  private model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('CHATGPT_OPENAI_KEY') ||
      this.configService.get<string>('OPENAI_API_KEY');

    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';

    if (apiKey && apiKey.trim() !== '' && !apiKey.startsWith('your_')) {
      this.openai = new OpenAI({ apiKey: apiKey.trim() });
      this.logger.log(`OpenAI Service initialized with model: ${this.model}`);
    } else {
      this.logger.warn('OpenAI API key not configured or set to placeholder. AI generation will use fallback mode.');
    }
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }

  async generateMealPlan(options: GeneratePlanOptions): Promise<AiGeneratedPlanResult> {
    if (!this.openai) {
      throw new Error('OpenAI client is not configured.');
    }

    const { user, pantryItems = [], overrides = {}, pricingCalibration, storeModifier } = options;

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
      Math.max(mealFrequency.breakfast, mealFrequency.lunch, mealFrequency.dinner, 7);
    const mealTypes =
      overrides.mealTypes && overrides.mealTypes.length > 0
        ? overrides.mealTypes
        : user.plannedMealTypes.length > 0
          ? user.plannedMealTypes
          : ['BREAKFAST', 'LUNCH', 'DINNER'];
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
      overrides.adultsCount !== undefined ? overrides.adultsCount : user.adultsCount || 1;
    const childrenCount =
      overrides.childrenCount !== undefined ? overrides.childrenCount : user.childrenCount || 0;
    const kitchenEquipment =
      overrides.kitchenEquipment || user.kitchenEquipment || [];
    const pantryStaples =
      overrides.pantryStaples || user.pantryStaples || [];
    const totalServings = Math.max(1, adultsCount + childrenCount);

    const currency = storeModifier?.currency || overrides.currency || user.currency || 'USD';
    const storeType = storeModifier?.storeType || overrides.preferredStoreType || user.preferredStoreType || 'STANDARD';
    const storeMultiplier = storeModifier?.storeMultiplier || 1.0;
    const location =
      [overrides.city || user.city, overrides.country || user.country].filter(Boolean).join(', ') ||
      'Standard Metro Area';

    const pantryStockText =
      overrides.includePantryItems !== false && pantryItems.length > 0
        ? pantryItems.map((p) => `- ${p.ingredientName} (${p.quantity} ${p.unit}, category: ${p.category})`).join('\n')
        : 'None provided';

    // Pricing calibration context instructions (Item 2)
    let calibrationPromptSection = '';
    if (pricingCalibration && pricingCalibration.sampleCount > 0) {
      const deltaPercent = Math.round((pricingCalibration.factor - 1) * 100);
      const direction = deltaPercent >= 0 ? `+${deltaPercent}% higher` : `${deltaPercent}% lower`;
      calibrationPromptSection = `
- HISTORICAL RECEIPT CALIBRATION (Item 2):
  Based on ${pricingCalibration.sampleCount} previous logged supermarket receipts, this user's actual spending averages ${direction} than standard baselines (calibration factor: ${pricingCalibration.factor.toFixed(2)}x).
  Adjust individual recipe price estimates by ${pricingCalibration.factor.toFixed(2)}x to ensure total cost accuracy matches their actual store checkout.`;
    }

    // Regional & Store modifier context instructions (Item 3)
    const storePromptSection = `
- REGIONAL & STORE MODIFIERS (Item 3):
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
            .join('\n')
        : 'Not pre-assigned; distribute across the planning period.';

    const systemPrompt = `You are a world-class professional culinary planner, certified nutritionist, and budget-optimization expert for a smart meal management platform.
Your task is to create a complete, practical, delicious, and budget-optimized weekly meal plan formatted strictly as JSON.

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
9. Strictly adhere to all dietary restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(', ') : 'None'}.
10. Cater to cuisine preferences: ${cuisinePreferences.length > 0 ? cuisinePreferences.join(', ') : 'Versatile/International'}.
11. Take advantage of available kitchen equipment: ${kitchenEquipment.length > 0 ? kitchenEquipment.join(', ') : 'Standard kitchen'}.
12. Prioritize and reuse ingredients already in the user's pantry/stock to reduce grocery costs and food waste:
${pantryStockText}
13. Respect preferred meal vibes: ${mealVibes.length > 0 ? mealVibes.join(', ') : 'Balanced & wholesome'}.
14. Apply pricing models:
${storePromptSection}
${calibrationPromptSection}
15. Output ONLY valid JSON according to the schema provided below. Do not wrap in markdown quotes or add conversational filler.`;

    const userPrompt = `Create the weekly meal plan with the following specifications:
- Planning Days: ${daysCount}
- Breakfast meals required: ${mealFrequency.breakfast}
- Lunch meals required: ${mealFrequency.lunch}
- Dinner meals required: ${mealFrequency.dinner}
- Total meals required: ${totalMealsRequired}
- Meal slot schedule (use these day/mealType assignments when provided):
${slotScheduleText}
- Target Weekly Budget: ${currency} ${weeklyBudget.toFixed(2)}
- Currency: ${currency}
- Store Tier: ${storeType} (${storeMultiplier.toFixed(2)}x)
- Location: ${location}
- Household: ${adultsCount} adults, ${childrenCount} children (Total servings: ${totalServings})
- Dietary Restrictions: ${dietaryRestrictions.join(', ') || 'None'}
- Cuisine Preferences: ${cuisinePreferences.join(', ') || 'Any'}
- Pantry Staples: ${pantryStaples.join(', ') || 'Standard pantry'}
- Special Custom Notes: ${overrides.customNotes || 'None'}

Return ONLY a JSON object with this exact structure:
{
  "planTitle": "e.g., Weekly Vegetarian Mediterranean Plan",
  "planOverview": "Brief summary of how the plan balances nutrition, budget, and pantry ingredients",
  "currency": "${currency}",
  "totalEstimatedCost": 124.50,
  "dailyTargetCalories": 2000,
  "meals": [
    {
      "dayOfWeek": 1,
      "mealType": "DINNER",
      "title": "Recipe Title",
      "description": "Short appetizing description",
      "prepTimeMinutes": 15,
      "servings": ${totalServings},
      "estimatedCost": 4.50,
      "cuisine": "American",
      "dietaryTags": ["HIGH_PROTEIN"],
      "instructions": ["Step 1...", "Step 2..."],
      "ingredients": [
        { "name": "Ingredient name", "quantity": "e.g. 200g or 2 tbsp", "category": "Produce" }
      ]
    }
  ]
}`;

    this.logger.log(
      `Calling OpenAI (${this.model}) to generate ${totalMealsRequired}-meal plan (${mealFrequency.breakfast} breakfast, ${mealFrequency.lunch} lunch, ${mealFrequency.dinner} dinner) for user ${user.id} in ${currency}...`,
    );

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Received empty response from OpenAI');
    }

    try {
      const parsed: AiGeneratedPlanResult = JSON.parse(content);
      if (!parsed.meals || !Array.isArray(parsed.meals) || parsed.meals.length === 0) {
        throw new Error('OpenAI response missing valid meals array');
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
        `OpenAI generated plan successfully: "${parsed.planTitle || 'Meal Plan'}" with ${parsed.meals.length} meals in ${currency}.`,
      );
      return parsed;
    } catch (parseError: any) {
      this.logger.error(`Failed to parse OpenAI response: ${parseError.message}`, content);
      throw new Error(`OpenAI response parsing failed: ${parseError.message}`);
    }
  }
}

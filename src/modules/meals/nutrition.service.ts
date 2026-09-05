import { Injectable, Logger, Optional } from "@nestjs/common";
import { OpenAiService } from "../ai/openai.service";

export interface NutritionResult {
  calories: number; // per adult serving
  totalCalories: number;
  proteinGrams: number; // per adult serving
  carbsGrams: number; // per adult serving
  fatGrams: number; // per adult serving
  servings: number;
}

export interface RawIngredient {
  name: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
}

@Injectable()
export class NutritionService {
  private readonly logger = new Logger(NutritionService.name);

  // Caloric density lookup table (calories per 100g or standard unit)
  private readonly INGREDIENT_CALORIES_MAP: Record<
    string,
    { kcalPer100g?: number; kcalPerUnit?: number; defaultGramsPerUnit?: number }
  > = {
    // Starches & Grains
    oat: { kcalPer100g: 389, defaultGramsPerUnit: 50 },
    rice: { kcalPer100g: 130, defaultGramsPerUnit: 150 },
    pasta: { kcalPer100g: 131, defaultGramsPerUnit: 150 },
    penne: { kcalPer100g: 131, defaultGramsPerUnit: 150 },
    noodle: { kcalPer100g: 138, defaultGramsPerUnit: 150 },
    soba: { kcalPer100g: 99, defaultGramsPerUnit: 150 },
    quinoa: { kcalPer100g: 368, defaultGramsPerUnit: 150 },
    couscous: { kcalPer100g: 112, defaultGramsPerUnit: 150 },
    potato: { kcalPer100g: 77, kcalPerUnit: 160 },
    sweet_potato: { kcalPer100g: 86, kcalPerUnit: 130 },
    bread: { kcalPer100g: 265, kcalPerUnit: 80 },
    sourdough: { kcalPer100g: 250, kcalPerUnit: 90 },
    tortilla: { kcalPer100g: 290, kcalPerUnit: 120 },
    pitta: { kcalPer100g: 275, kcalPerUnit: 150 },
    bagel: { kcalPer100g: 270, kcalPerUnit: 250 },
    ciabatta: { kcalPer100g: 260, kcalPerUnit: 180 },
    polenta: { kcalPer100g: 350, defaultGramsPerUnit: 100 },
    granola: { kcalPer100g: 470, defaultGramsPerUnit: 50 },

    // Meats & Poultry
    chicken_breast: { kcalPer100g: 165, kcalPerUnit: 200 },
    chicken_thigh: { kcalPer100g: 209, kcalPerUnit: 220 },
    chicken: { kcalPer100g: 175, kcalPerUnit: 210 },
    turkey_breast: { kcalPer100g: 135, kcalPerUnit: 180 },
    turkey: { kcalPer100g: 145, kcalPerUnit: 190 },
    beef_steak: { kcalPer100g: 250, kcalPerUnit: 350 },
    beef_mince: { kcalPer100g: 254, defaultGramsPerUnit: 200 },
    beef: { kcalPer100g: 250, kcalPerUnit: 300 },
    pork_chop: { kcalPer100g: 242, kcalPerUnit: 280 },
    pork: { kcalPer100g: 242, kcalPerUnit: 280 },
    lamb_chop: { kcalPer100g: 294, kcalPerUnit: 320 },
    lamb: { kcalPer100g: 294, kcalPerUnit: 320 },
    bacon: { kcalPer100g: 541, kcalPerUnit: 45 },
    sausage: { kcalPer100g: 301, kcalPerUnit: 180 },

    // Fish & Seafood
    salmon: { kcalPer100g: 208, kcalPerUnit: 250 },
    tuna: { kcalPer100g: 132, kcalPerUnit: 150 },
    cod: { kcalPer100g: 82, kcalPerUnit: 120 },
    haddock: { kcalPer100g: 88, kcalPerUnit: 130 },
    prawn: { kcalPer100g: 99, defaultGramsPerUnit: 100 },
    shrimp: { kcalPer100g: 99, defaultGramsPerUnit: 100 },
    sea_bass: { kcalPer100g: 97, kcalPerUnit: 140 },

    // Dairy, Eggs & Alternatives
    egg: { kcalPer100g: 143, kcalPerUnit: 75 },
    milk: { kcalPer100g: 42, defaultGramsPerUnit: 250 },
    greek_yogurt: { kcalPer100g: 97, defaultGramsPerUnit: 150 },
    yogurt: { kcalPer100g: 61, defaultGramsPerUnit: 150 },
    cheddar: { kcalPer100g: 402, kcalPerUnit: 110 },
    mozzarella: { kcalPer100g: 280, kcalPerUnit: 85 },
    parmesan: { kcalPer100g: 431, kcalPerUnit: 45 },
    feta: { kcalPer100g: 264, kcalPerUnit: 75 },
    goat_cheese: { kcalPer100g: 364, kcalPerUnit: 80 },
    halloumi: { kcalPer100g: 321, kcalPerUnit: 160 },
    cream_cheese: { kcalPer100g: 342, defaultGramsPerUnit: 30 },
    heavy_cream: { kcalPer100g: 345, defaultGramsPerUnit: 30 },
    butter: { kcalPer100g: 717, kcalPerUnit: 100 },
    coconut_milk: { kcalPer100g: 230, defaultGramsPerUnit: 200 },
    tofu: { kcalPer100g: 76, kcalPerUnit: 150 },
    tempeh: { kcalPer100g: 193, kcalPerUnit: 200 },

    // Oils, Fats & Condiments
    olive_oil: { kcalPer100g: 884, kcalPerUnit: 120 },
    oil: { kcalPer100g: 884, kcalPerUnit: 120 },
    sesame_oil: { kcalPer100g: 884, kcalPerUnit: 120 },
    peanut_butter: { kcalPer100g: 588, kcalPerUnit: 95 },
    honey: { kcalPer100g: 304, kcalPerUnit: 65 },
    maple_syrup: { kcalPer100g: 260, kcalPerUnit: 50 },
    mayonnaise: { kcalPer100g: 680, kcalPerUnit: 90 },
    pesto: { kcalPer100g: 450, kcalPerUnit: 80 },
    curry_paste: { kcalPer100g: 120, kcalPerUnit: 30 },
    soy_sauce: { kcalPer100g: 53, kcalPerUnit: 10 },
    canned_tomatoes: { kcalPer100g: 32, kcalPerUnit: 130 },

    // Legumes, Nuts & Seeds
    chickpea: { kcalPer100g: 164, kcalPerUnit: 360 },
    black_bean: { kcalPer100g: 132, kcalPerUnit: 330 },
    kidney_bean: { kcalPer100g: 127, kcalPerUnit: 320 },
    lentil: { kcalPer100g: 116, defaultGramsPerUnit: 150 },
    edamame: { kcalPer100g: 122, defaultGramsPerUnit: 100 },
    almond: { kcalPer100g: 579, defaultGramsPerUnit: 30 },
    walnut: { kcalPer100g: 654, defaultGramsPerUnit: 30 },
    chia_seed: { kcalPer100g: 486, defaultGramsPerUnit: 20 },
    flaxseed: { kcalPer100g: 534, defaultGramsPerUnit: 20 },
    pumpkin_seed: { kcalPer100g: 559, defaultGramsPerUnit: 30 },

    // Produce (Vegetables & Fruits)
    avocado: { kcalPer100g: 160, kcalPerUnit: 240 },
    banana: { kcalPer100g: 89, kcalPerUnit: 105 },
    apple: { kcalPer100g: 52, kcalPerUnit: 95 },
    berry: { kcalPer100g: 57, defaultGramsPerUnit: 100 },
    spinach: { kcalPer100g: 23, defaultGramsPerUnit: 100 },
    kale: { kcalPer100g: 49, defaultGramsPerUnit: 100 },
    broccoli: { kcalPer100g: 34, defaultGramsPerUnit: 150 },
    cauliflower: { kcalPer100g: 25, defaultGramsPerUnit: 150 },
    bell_pepper: { kcalPer100g: 31, kcalPerUnit: 40 },
    pepper: { kcalPer100g: 31, kcalPerUnit: 40 },
    cucumber: { kcalPer100g: 15, kcalPerUnit: 45 },
    tomato: { kcalPer100g: 18, kcalPerUnit: 25 },
    zucchini: { kcalPer100g: 17, kcalPerUnit: 30 },
    eggplant: { kcalPer100g: 25, kcalPerUnit: 60 },
    carrot: { kcalPer100g: 41, kcalPerUnit: 30 },
    onion: { kcalPer100g: 40, kcalPerUnit: 45 },
    shallot: { kcalPer100g: 72, kcalPerUnit: 15 },
    garlic: { kcalPer100g: 149, kcalPerUnit: 5 },
    mushroom: { kcalPer100g: 22, defaultGramsPerUnit: 150 },
    green_bean: { kcalPer100g: 31, defaultGramsPerUnit: 100 },
    lettuce: { kcalPer100g: 15, kcalPerUnit: 30 },
    kimchi: { kcalPer100g: 25, defaultGramsPerUnit: 80 },
    olive: { kcalPer100g: 115, defaultGramsPerUnit: 30 },
  };

  constructor(@Optional() private readonly openAiService?: OpenAiService) {}

  /**
   * Calculates estimated calories and macros per adult serving for a given meal recipe.
   */
  calculateMealNutrition(meal: {
    title?: string;
    mealType?: string;
    cuisine?: string;
    servings?: number;
    ingredients?: any;
    dietaryTags?: string[];
  }): NutritionResult {
    const servings = Math.max(1, Number(meal.servings) || 4);
    const ingredients: RawIngredient[] = Array.isArray(meal.ingredients)
      ? meal.ingredients
      : [];

    let totalCalories = 0;

    if (ingredients.length > 0) {
      for (const ing of ingredients) {
        totalCalories += this.estimateIngredientCalories(ing);
      }
    }

    // If ingredients provided too few calories (< 200 per meal total) or empty, apply baseline calculation
    const rawPerServing = totalCalories / servings;
    let finalPerServing = rawPerServing;

    if (finalPerServing < 180) {
      finalPerServing = this.getDefaultMealTypeCalories(
        meal.mealType,
        meal.dietaryTags,
      );
      totalCalories = Math.round(finalPerServing * servings);
    } else {
      finalPerServing = Math.round(finalPerServing);
    }

    // Clamp to realistic adult meal boundary (200 - 1200 kcal/serving)
    finalPerServing = Math.max(220, Math.min(1150, finalPerServing));

    // Calculate realistic macro breakdown based on calories and dietary tags
    const isHighProtein = meal.dietaryTags?.some((t) =>
      t.toUpperCase().includes("PROTEIN"),
    );
    const isKeto = meal.dietaryTags?.some(
      (t) =>
        t.toUpperCase().includes("KETO") ||
        t.toUpperCase().includes("LOW_CARB"),
    );
    const isVegan = meal.dietaryTags?.some((t) =>
      t.toUpperCase().includes("VEGAN"),
    );

    let proteinRatio = 0.25;
    let carbsRatio = 0.45;
    let fatRatio = 0.3;

    if (isKeto) {
      proteinRatio = 0.3;
      carbsRatio = 0.1;
      fatRatio = 0.6;
    } else if (isHighProtein) {
      proteinRatio = 0.35;
      carbsRatio = 0.4;
      fatRatio = 0.25;
    } else if (isVegan) {
      proteinRatio = 0.18;
      carbsRatio = 0.57;
      fatRatio = 0.25;
    }

    const proteinGrams = Math.round((finalPerServing * proteinRatio) / 4);
    const carbsGrams = Math.round((finalPerServing * carbsRatio) / 4);
    const fatGrams = Math.round((finalPerServing * fatRatio) / 9);

    return {
      calories: finalPerServing,
      totalCalories,
      proteinGrams,
      carbsGrams,
      fatGrams,
      servings,
    };
  }

  private estimateIngredientCalories(ing: RawIngredient): number {
    if (!ing || !ing.name) return 50;

    const matchedKey = this.matchIngredientKey(ing.name);
    const lookup = matchedKey ? this.INGREDIENT_CALORIES_MAP[matchedKey] : null;

    const qtyString = String(ing.quantity || "")
      .toLowerCase()
      .trim();
    const unitString = String(ing.unit || "")
      .toLowerCase()
      .trim();

    const parsedNumber = this.extractNumericQuantity(qtyString);

    const isKg =
      /\bkg\b|\bkilograms?\b|\d+\s*kg\b/i.test(qtyString) ||
      unitString === "kg";
    const isGrams =
      /\bg\b|\bgrams?\b|\d+\s*g\b/i.test(qtyString) ||
      unitString === "g" ||
      unitString === "gram" ||
      unitString === "grams";
    const isMl =
      /\bml\b|\bmilliliters?\b|\d+\s*ml\b/i.test(qtyString) ||
      unitString === "ml";
    const isLiters =
      /\bl\b|\bliters?\b|\blitres?\b|\d+\s*l\b/i.test(qtyString) ||
      unitString === "l";
    const isTbsp =
      /tbsp|tablespoon/i.test(qtyString) || /tbsp|tablespoon/i.test(unitString);
    const isTsp =
      /tsp|teaspoon/i.test(qtyString) || /tsp|teaspoon/i.test(unitString);
    const isCup = /cup/i.test(qtyString) || /cup/i.test(unitString);
    const isCan = /can/i.test(qtyString) || /can/i.test(unitString);
    const isJar = /jar/i.test(qtyString) || /jar/i.test(unitString);
    const isFillet = /fillet/i.test(qtyString) || /fillet/i.test(unitString);
    const isSlice = /slice/i.test(qtyString) || /slice/i.test(unitString);

    // 1. Grams / kg parsing
    if (isKg) {
      const grams = parsedNumber * 1000;
      const kcal100 = lookup?.kcalPer100g || 150;
      return (grams / 100) * kcal100;
    }

    if (isGrams) {
      const grams = parsedNumber;
      const kcal100 = lookup?.kcalPer100g || 150;
      return (grams / 100) * kcal100;
    }

    // 2. Liquid ml / L parsing
    if (isMl) {
      const ml = parsedNumber;
      const kcal100 = lookup?.kcalPer100g || 120;
      return (ml / 100) * kcal100;
    }

    if (isLiters) {
      const ml = parsedNumber * 1000;
      const kcal100 = lookup?.kcalPer100g || 120;
      return (ml / 100) * kcal100;
    }

    // 3. Tablespoons / teaspoons / cups
    if (isTbsp) {
      const kcalPerTbsp =
        lookup?.kcalPerUnit ||
        (lookup?.kcalPer100g ? (lookup.kcalPer100g * 15) / 100 : 45);
      return parsedNumber * kcalPerTbsp;
    }

    if (isTsp) {
      const kcalPerTsp = lookup?.kcalPerUnit ? lookup.kcalPerUnit / 3 : 15;
      return parsedNumber * kcalPerTsp;
    }

    if (isCup) {
      const cupWeight = lookup?.defaultGramsPerUnit || 150;
      const kcal100 = lookup?.kcalPer100g || 200;
      return parsedNumber * ((cupWeight / 100) * kcal100);
    }

    // 4. Cans / Jars / Fillets / Slices / Pieces
    if (isCan) {
      return (
        parsedNumber *
        (lookup?.kcalPerUnit ||
          (lookup?.kcalPer100g ? lookup.kcalPer100g * 4 : 320))
      );
    }

    if (isJar) {
      return parsedNumber * (lookup?.kcalPerUnit || 400);
    }

    if (isFillet) {
      return parsedNumber * (lookup?.kcalPerUnit || 230);
    }

    if (isSlice) {
      return parsedNumber * (lookup?.kcalPerUnit || 90);
    }

    // 5. Piece / count based default
    if (lookup?.kcalPerUnit) {
      return parsedNumber * lookup.kcalPerUnit;
    }

    if (lookup?.kcalPer100g && lookup?.defaultGramsPerUnit) {
      return (
        parsedNumber * ((lookup.defaultGramsPerUnit / 100) * lookup.kcalPer100g)
      );
    }

    // Fallback heuristic by category
    const category = (ing.category || "").toLowerCase();
    if (category.includes("meat") || category.includes("fish")) {
      return parsedNumber * 220;
    }
    if (category.includes("dairy") || category.includes("cheese")) {
      return parsedNumber * 180;
    }
    if (category.includes("pantry") || category.includes("grain")) {
      return parsedNumber * 150;
    }
    if (category.includes("produce") || category.includes("vegetable")) {
      return parsedNumber * 35;
    }

    return parsedNumber * 75;
  }

  private extractNumericQuantity(qtyStr: string): number {
    const match = qtyStr.match(/(\d+(\.\d+)?)/);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      return val > 0 ? val : 1;
    }
    return 1;
  }

  private matchIngredientKey(name: string): string | null {
    const cleaned = (name || "").toLowerCase().replace(/[^a-z0-9_ ]/g, " ");
    const nameTokens = cleaned.split(/\s+/).filter(Boolean);

    // Sort keys by length descending so more specific multi-word keys match first
    const sortedKeys = Object.keys(this.INGREDIENT_CALORIES_MAP).sort(
      (a, b) => b.length - a.length,
    );
    for (const key of sortedKeys) {
      const matchWords = key.split("_");
      const matchesAll = matchWords.every((w) =>
        nameTokens.some(
          (token) =>
            token === w ||
            token.startsWith(w) ||
            (w.length > 4 && token.includes(w)),
        ),
      );
      if (matchesAll) {
        return key;
      }
    }
    return null;
  }

  private getDefaultMealTypeCalories(
    mealType?: string,
    dietaryTags?: string[],
  ): number {
    const normalized = (mealType || "").toUpperCase();
    if (normalized.includes("BREAKFAST")) {
      return 420;
    }
    if (normalized.includes("LUNCH")) {
      return 520;
    }
    if (normalized.includes("DINNER")) {
      return 650;
    }
    return 550;
  }
}

import { Test, TestingModule } from "@nestjs/testing";
import { NutritionService } from "./nutrition.service";

describe("NutritionService", () => {
  let service: NutritionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NutritionService],
    }).compile();

    service = module.get<NutritionService>(NutritionService);
  });

  it("should calculate accurate calories per adult serving from ingredient quantities and servings", () => {
    const meal = {
      title: "Grilled Salmon with Quinoa & Steamed Broccoli",
      mealType: "Dinner",
      servings: 2,
      dietaryTags: ["HIGH_PROTEIN", "PESCATARIAN", "GLUTEN_FREE"],
      ingredients: [
        {
          name: "Salmon Fillet",
          quantity: "2 fillets",
          category: "Meat & Fish",
        },
        { name: "Quinoa", quantity: "150g", category: "Pantry Staples" },
        { name: "Broccoli", quantity: "200g", category: "Produce" },
        { name: "Olive Oil", quantity: "1 tbsp", category: "Pantry Staples" },
      ],
    };

    const result = service.calculateMealNutrition(meal);

    expect(result.servings).toBe(2);
    expect(result.calories).toBeGreaterThan(500);
    expect(result.calories).toBeLessThan(750);
    expect(result.proteinGrams).toBeGreaterThan(25);
    expect(result.carbsGrams).toBeGreaterThan(30);
    expect(result.fatGrams).toBeGreaterThan(10);
  });

  it("should adjust calories per serving properly when servings change", () => {
    const meal = {
      title: "Chickpea & Coconut Curry",
      mealType: "Dinner",
      servings: 2,
      dietaryTags: ["VEGAN"],
      ingredients: [
        { name: "Chickpeas", quantity: "1 can" },
        { name: "Coconut milk", quantity: "1 can" },
        { name: "Rice", quantity: "200g" },
        { name: "Spinach", quantity: "100g" },
      ],
    };

    const result2 = service.calculateMealNutrition({ ...meal, servings: 2 });
    const result4 = service.calculateMealNutrition({ ...meal, servings: 4 });

    expect(result4.calories).toBeLessThan(result2.calories);
    expect(result2.calories).toBeGreaterThan(500);
    expect(result4.calories).toBeGreaterThan(250);
  });

  it("should provide realistic default meal type calories when ingredient list is minimal or empty", () => {
    const breakfast = service.calculateMealNutrition({
      title: "Avocado Toast",
      mealType: "BREAKFAST",
      servings: 1,
    });
    expect(breakfast.calories).toBeGreaterThan(350);
    expect(breakfast.calories).toBeLessThan(550);

    const dinner = service.calculateMealNutrition({
      title: "Chef Special Stew",
      mealType: "DINNER",
      servings: 4,
    });
    expect(dinner.calories).toBeGreaterThan(550);
    expect(dinner.calories).toBeLessThan(850);
  });
});

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsString,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GeneratePlanPantryItemDto {
  @ApiPropertyOptional({ example: 'Chicken Breast', description: 'Name of the ingredient' })
  @IsString()
  ingredientName: string;

  @ApiPropertyOptional({ example: 'Meat & Poultry', description: 'Department or category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 500, description: 'Quantity in stock' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ example: 'g', description: 'Unit of measurement (g, kg, pcs, tbsp, etc.)' })
  @IsOptional()
  @IsString()
  unit?: string;
}

export class GenerateMealPlanDto {
  @ApiPropertyOptional({
    description: 'Target weekly grocery budget in USD (Onboarding Step 4)',
    example: 150.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  weeklyBudget?: number;

  @ApiPropertyOptional({
    description: 'Number of days for the meal plan (1-14, Onboarding Step 3)',
    example: 7,
    minimum: 1,
    maximum: 14,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  @Type(() => Number)
  daysCount?: number;

  @ApiPropertyOptional({
    description: 'Alias for daysCount (Onboarding Step 3)',
    example: 7,
    minimum: 1,
    maximum: 14,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  @Type(() => Number)
  plannedDaysCount?: number;

  @ApiPropertyOptional({
    description: 'Meal slots to cover (e.g. BREAKFAST, LUNCH, DINNER, SNACK - Onboarding Step 3)',
    example: ['BREAKFAST', 'LUNCH', 'DINNER'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mealTypes?: string[];

  @ApiPropertyOptional({
    description: 'Alias for mealTypes (Onboarding Step 3)',
    example: ['BREAKFAST', 'LUNCH', 'DINNER'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  plannedMealTypes?: string[];

  @ApiPropertyOptional({
    description: 'Number of adults in household (ages 13+, Onboarding Step 2)',
    example: 2,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  adultsCount?: number;

  @ApiPropertyOptional({
    description: 'Number of children in household (Onboarding Step 2)',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  childrenCount?: number;

  @ApiPropertyOptional({
    description: 'Preferred meal styles/vibes (e.g. BALANCED, QUICK_EASY, HIGH_PROTEIN, BUDGET_FRIENDLY - Onboarding Step 5)',
    example: ['QUICK_EASY', 'HIGH_PROTEIN'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mealVibes?: string[];

  @ApiPropertyOptional({
    description: 'Available kitchen equipment (e.g. HOB, OVEN, AIR_FRYER, SLOW_COOKER, BLENDER - Onboarding Step 6)',
    example: ['AIR_FRYER', 'OVEN', 'HOB'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kitchenEquipment?: string[];

  @ApiPropertyOptional({
    description: 'Pre-existing pantry staples (e.g. Olive Oil, Garlic, Rice, Pasta, Salt & Pepper - Onboarding Step 7)',
    example: ['Olive Oil', 'Garlic', 'Rice', 'Soy Sauce'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pantryStaples?: string[];

  @ApiPropertyOptional({
    description: 'Specific in-stock pantry items/ingredients to incorporate in this generation',
    type: [GeneratePlanPantryItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneratePlanPantryItemDto)
  pantryItems?: GeneratePlanPantryItemDto[];

  @ApiPropertyOptional({
    description: 'Dietary restrictions (e.g., VEGETARIAN, GLUTEN_FREE, KETO, HALAL, DAIRY_FREE - Onboarding Step 8)',
    example: ['HIGH_PROTEIN', 'GLUTEN_FREE'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryRestrictions?: string[];

  @ApiPropertyOptional({
    description: 'Preferred cuisines (e.g., ITALIAN, MEXICAN, ASIAN, MEDITERRANEAN - Onboarding Step 8)',
    example: ['MEDITERRANEAN', 'ASIAN'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisinePreferences?: string[];

  @ApiPropertyOptional({
    description: 'Whether to incorporate existing database pantry stock into the plan',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includePantryItems?: boolean;

  @ApiPropertyOptional({
    description: 'Preferred supermarket tier/chain (e.g. DISCOUNT / STANDARD / PREMIUM_ORGANIC or Aldi, Whole Foods)',
    example: 'DISCOUNT',
  })
  @IsOptional()
  @IsString()
  preferredStoreType?: string;

  @ApiPropertyOptional({
    description: 'Currency code for budgeting and pricing (e.g. USD, GBP, EUR, CAD, AUD)',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'User Country for regional price calibration',
    example: 'United States',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'User City / Metro area for local price indexing',
    example: 'Chicago',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Specific custom requests or focus areas for the AI',
    example: 'Focus on 20-minute dinners with high protein content',
  })
  @IsOptional()
  @IsString()
  customNotes?: string;

  @ApiPropertyOptional({
    description: 'If true, updates the user profile with these onboarding values for future use',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  saveToProfile?: boolean;
}

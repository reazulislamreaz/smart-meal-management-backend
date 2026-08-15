import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateOnboardingDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Current onboarding step (1 to 8)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  onboardingStep?: number;

  @ApiPropertyOptional({
    example: 'Jane Doe',
    description: 'Step 1: User preferred display name',
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Step 2: Number of adults in household (ages 13+)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  adultsCount?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Step 2: Number of children in household',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  childrenCount?: number;

  @ApiPropertyOptional({
    example: ['BREAKFAST', 'LUNCH', 'DINNER'],
    description: 'Step 3: Meals to cover in the plan',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  plannedMealTypes?: string[];

  @ApiPropertyOptional({
    example: 7,
    description: 'Step 3: How many days to plan (1 to 7)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  plannedDaysCount?: number;

  @ApiPropertyOptional({
    example: 200.0,
    description: 'Step 4: Target weekly grocery budget',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklyBudget?: number;

  @ApiPropertyOptional({
    example: ['BALANCED', 'QUICK_EASY', 'HIGH_PROTEIN'],
    description: 'Step 5: Preferred meal vibes / styles (up to 3)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mealVibes?: string[];

  @ApiPropertyOptional({
    example: ['HOB', 'OVEN', 'AIR_FRYER'],
    description: 'Step 6: Available kitchen equipment',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kitchenEquipment?: string[];

  @ApiPropertyOptional({
    example: ['Eggs', 'Milk', 'Butter', 'Pasta'],
    description: 'Step 7: Pre-existing pantry staple ingredients',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pantryStaples?: string[];

  @ApiPropertyOptional({
    example: ['VEGETARIAN', 'GLUTEN_FREE'],
    description: 'Step 8: Dietary restrictions',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryRestrictions?: string[];

  @ApiPropertyOptional({
    example: ['ITALIAN', 'MEXICAN', 'ASIAN'],
    description: 'Step 8: Cuisine preferences',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisinePreferences?: string[];

  @ApiPropertyOptional({
    example: 'DISCOUNT',
    description: 'Preferred supermarket tier or chain (e.g. DISCOUNT / STANDARD / PREMIUM_ORGANIC or Aldi, Whole Foods)',
  })
  @IsOptional()
  @IsString()
  preferredStoreType?: string;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Currency ISO code (e.g. USD, GBP, EUR, CAD, AUD)',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    example: 'United States',
    description: 'User Country for regional price calibration',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    example: 'Chicago',
    description: 'User City / Metro area',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Mark onboarding flow as complete',
  })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}

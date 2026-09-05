import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from "class-validator";

export class RecommendMealsDto {
  @ApiPropertyOptional({
    description: "Specific meal slot context (e.g. BREAKFAST, LUNCH, DINNER)",
    example: "DINNER",
  })
  @IsOptional()
  @IsString()
  mealType?: string;

  @ApiPropertyOptional({
    description:
      "Cuisine style preference (e.g. Mediterranean, Mexican, Asian, Italian)",
    example: "Mediterranean",
  })
  @IsOptional()
  @IsString()
  cuisine?: string;

  @ApiPropertyOptional({
    description:
      "Comma-separated dietary tags (e.g. VEGETARIAN,HIGH_PROTEIN,GLUTEN_FREE)",
    example: "HIGH_PROTEIN,GLUTEN_FREE",
  })
  @IsOptional()
  @IsString()
  dietaryTags?: string;

  @ApiPropertyOptional({
    description: "Array of dietary restrictions to enforce strictly",
    example: ["HIGH_PROTEIN"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryRestrictions?: string[];

  @ApiPropertyOptional({
    description: "Maximum cooking/prep time in minutes",
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  maxPrepTime?: number;

  @ApiPropertyOptional({
    description: "Maximum cost per serving or recipe",
    example: 8.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCost?: number;

  @ApiPropertyOptional({
    description: "Meal vibes / flavor desires",
    example: ["Quick & Easy", "Comfort Food"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mealVibes?: string[];

  @ApiPropertyOptional({
    description: "Kitchen equipment available",
    example: ["Air Fryer", "Instant Pot", "Oven"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kitchenEquipment?: string[];

  @ApiPropertyOptional({
    description:
      "Number of meal recommendations requested (default: 5, max: 20)",
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  count?: number;

  @ApiPropertyOptional({
    description: "Meal IDs to exclude to ensure non-repetitive suggestions",
    example: ["meal-101", "meal-102"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeMealIds?: string[];

  @ApiPropertyOptional({
    description: "Whether to factor in user pantry items to minimize waste",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includePantry?: boolean;

  @ApiPropertyOptional({
    description: "Custom instructions or craving prompt",
    example:
      "I want a spicy high-protein dinner ready in under 20 mins using chicken breast",
  })
  @IsOptional()
  @IsString()
  customPrompt?: string;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
} from "class-validator";

export class CreateAdminMealDto {
  @ApiProperty({
    example: "Grilled Lemon Herb Salmon",
    description: "Recipe title",
  })
  @IsString()
  @IsNotEmpty({ message: "Recipe title is required" })
  title: string;

  @ApiPropertyOptional({
    example:
      "Fresh salmon fillets marinated with rosemary, garlic, and freshly squeezed lemon",
    description: "Recipe description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 20,
    default: 15,
    description: "Prep time in minutes",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  prepTimeMinutes?: number;

  @ApiPropertyOptional({
    example: 4,
    default: 4,
    description: "Servings yield",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  servings?: number;

  @ApiPropertyOptional({
    example: 22.5,
    default: 15.0,
    description: "Estimated ingredient cost",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @ApiPropertyOptional({ example: "Mediterranean", default: "American" })
  @IsOptional()
  @IsString()
  cuisine?: string;

  @ApiPropertyOptional({
    example: ["HIGH_PROTEIN", "GLUTEN_FREE", "PESCATARIAN"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryTags?: string[];

  @ApiPropertyOptional({
    example: [
      "Preheat skillet with olive oil",
      "Season salmon with herbs, salt, and pepper",
      "Sear for 4-5 mins each side",
    ],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instructions?: string[];

  @ApiPropertyOptional({
    example: [
      {
        name: "Salmon Fillet",
        category: "Meat & Fish",
        quantity: "500g",
        unit: "g",
      },
      { name: "Lemon", category: "Produce", quantity: "1 pc", unit: "pcs" },
    ],
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  ingredients?: any[];

  @ApiPropertyOptional({ example: "Dinner", default: "Dinner" })
  @IsOptional()
  @IsString()
  mealType?: string;

  @ApiPropertyOptional({ example: "Active", default: "Active" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    example: "https://images.unsplash.com/photo-1467003909585-2f8a72700288",
    description: "Image URL",
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateAdminMealDto {
  @ApiPropertyOptional({ example: "Grilled Herb Salmon & Asparagus" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "Updated description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  prepTimeMinutes?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  servings?: number;

  @ApiPropertyOptional({ example: 24.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @ApiPropertyOptional({ example: "Mediterranean" })
  @IsOptional()
  @IsString()
  cuisine?: string;

  @ApiPropertyOptional({ example: "Dinner" })
  @IsOptional()
  @IsString()
  mealType?: string;

  @ApiPropertyOptional({ example: "Active" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryTags?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instructions?: string[];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  ingredients?: any[];

  @ApiPropertyOptional({ example: "https://images.unsplash.com/photo-sample" })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdatePantryItemDto {
  @ApiPropertyOptional({
    example: "Chickpeas",
    description: "Ingredient or item name",
  })
  @IsOptional()
  @IsString()
  ingredientName?: string;

  @ApiPropertyOptional({
    example: "Pantry",
    description:
      "Department/category (Produce, Meat & Fish, Dairy, Pantry, Other)",
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 1.0, description: "Quantity count" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({
    example: "can",
    description: "Unit (pcs, g, kg, can, tbsp)",
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: false, description: "Is low stock" })
  @IsOptional()
  @IsBoolean()
  isLowStock?: boolean;

  @ApiPropertyOptional({
    example: "2027-01-01T00:00:00.000Z",
    description: "Optional expiry date (ISO date string or empty/null)",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  expiryDate?: string | null;
}

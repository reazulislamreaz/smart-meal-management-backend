import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePantryItemDto {
  @ApiProperty({ example: 'Chickpeas', description: 'Ingredient or item name' })
  @IsString()
  @IsNotEmpty()
  ingredientName: string;

  @ApiPropertyOptional({ example: 'Pantry', description: 'Department/category (Produce, Meat & Fish, Dairy, Pantry, Other)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 1.0, description: 'Quantity count' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 'can', description: 'Unit (pcs, g, kg, can, tbsp)' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: false, description: 'Is low stock' })
  @IsOptional()
  @IsBoolean()
  isLowStock?: boolean;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMealPlanItemDto {
  @ApiPropertyOptional({
    description: 'Day of week (1 to 7: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday)',
    example: 3,
    minimum: 1,
    maximum: 14,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  @Type(() => Number)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Target meal slot (e.g. Move to BREAKFAST or Move to DINNER)',
    enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'],
    example: 'BREAKFAST',
  })
  @IsOptional()
  @IsString()
  mealType?: string;

  @ApiPropertyOptional({
    description: 'Optional ID of replacement recipe from catalog',
    example: 'uuid-meal-id',
  })
  @IsOptional()
  @IsString()
  mealId?: string;

  @ApiPropertyOptional({
    description: 'Whether this planned meal has already been prepared/cooked',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isCooked?: boolean;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMealPlanItemDto {
  @ApiPropertyOptional({
    description: 'Day of week (1 to 7, or up to 14)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  @Type(() => Number)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Meal slot type (e.g. BREAKFAST, LUNCH, DINNER, SNACK)',
    example: 'BREAKFAST',
  })
  @IsOptional()
  @IsString()
  mealType?: string;

  @ApiPropertyOptional({
    description: 'ID of new meal from catalog if replacing recipe',
    example: 'uuid-meal-id',
  })
  @IsOptional()
  @IsString()
  mealId?: string;

  @ApiPropertyOptional({
    description: 'Whether the meal has been cooked or prepared',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isCooked?: boolean;
}

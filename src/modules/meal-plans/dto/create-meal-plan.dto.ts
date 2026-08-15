import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsString,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMealPlanItemDto {
  @ApiProperty({ description: 'ID of the meal from the catalog', example: 'uuid-meal-id' })
  @IsNotEmpty()
  @IsString()
  mealId: string;

  @ApiProperty({ description: 'Day of week (1 to 7 or 14)', example: 1 })
  @IsInt()
  @Min(1)
  @Max(14)
  @Type(() => Number)
  dayOfWeek: number;

  @ApiProperty({ description: 'Meal slot type', example: 'LUNCH' })
  @IsNotEmpty()
  @IsString()
  mealType: string;
}

export class CreateMealPlanDto {
  @ApiPropertyOptional({
    description: 'Start date of the meal plan (defaults to today)',
    example: '2026-08-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date of the meal plan (defaults to start date + 7 days)',
    example: '2026-08-22T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Array of meal plan items with day and meal slot mapping',
    type: [CreateMealPlanItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMealPlanItemDto)
  items: CreateMealPlanItemDto[];
}

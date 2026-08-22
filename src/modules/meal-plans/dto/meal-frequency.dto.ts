import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';

export const MAX_MEAL_FREQUENCY_PER_TYPE = 21;
export const DEFAULT_PLANNING_DAYS = 7;
export const MAX_PLANNING_DAYS = 14;

export class MealFrequencyDto {
  @ApiProperty({
    example: 0,
    description: 'Number of breakfast meals to generate for the plan',
    minimum: 0,
    maximum: MAX_MEAL_FREQUENCY_PER_TYPE,
  })
  @IsInt()
  @Min(0)
  @Max(MAX_MEAL_FREQUENCY_PER_TYPE)
  @Type(() => Number)
  breakfast: number;

  @ApiProperty({
    example: 3,
    description: 'Number of lunch meals to generate for the plan',
    minimum: 0,
    maximum: MAX_MEAL_FREQUENCY_PER_TYPE,
  })
  @IsInt()
  @Min(0)
  @Max(MAX_MEAL_FREQUENCY_PER_TYPE)
  @Type(() => Number)
  lunch: number;

  @ApiProperty({
    example: 5,
    description: 'Number of dinner meals to generate for the plan',
    minimum: 0,
    maximum: MAX_MEAL_FREQUENCY_PER_TYPE,
  })
  @IsInt()
  @Min(0)
  @Max(MAX_MEAL_FREQUENCY_PER_TYPE)
  @Type(() => Number)
  dinner: number;
}

export class OptionalMealFrequencyDto {
  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: MAX_MEAL_FREQUENCY_PER_TYPE })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MEAL_FREQUENCY_PER_TYPE)
  @Type(() => Number)
  breakfast?: number;

  @ApiPropertyOptional({ example: 3, minimum: 0, maximum: MAX_MEAL_FREQUENCY_PER_TYPE })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MEAL_FREQUENCY_PER_TYPE)
  @Type(() => Number)
  lunch?: number;

  @ApiPropertyOptional({ example: 5, minimum: 0, maximum: MAX_MEAL_FREQUENCY_PER_TYPE })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MEAL_FREQUENCY_PER_TYPE)
  @Type(() => Number)
  dinner?: number;
}

export class MealFrequencyFieldDto {
  @ApiPropertyOptional({ type: OptionalMealFrequencyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptionalMealFrequencyDto)
  mealFrequency?: OptionalMealFrequencyDto;
}

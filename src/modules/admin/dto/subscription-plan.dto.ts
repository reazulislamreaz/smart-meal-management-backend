import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  Max,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Family Tier', description: 'Name of the subscription plan tier' })
  @IsString()
  @IsNotEmpty({ message: 'Plan name is required' })
  name: string;

  @ApiPropertyOptional({
    example: 'Full AI meal planning for up to 6 family members',
    description: 'Detailed description of plan benefits',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 14.99, description: 'Price of the plan' })
  @IsNumber()
  @Min(0, { message: 'Price cannot be negative' })
  price: number;

  @ApiPropertyOptional({
    example: 'monthly',
    enum: ['weekly', 'monthly', 'yearly'],
    default: 'monthly',
  })
  @IsOptional()
  @IsString()
  interval?: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    example: [
      'Unlimited AI weekly meal plans',
      'Smart grocery list with pantry deduction',
      'Family multi-user access',
    ],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: 20.0, description: 'Optional promotional discount percent' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({ example: 'Family Tier Plus' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated benefits description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 19.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'monthly', enum: ['weekly', 'monthly', 'yearly'] })
  @IsOptional()
  @IsString()
  interval?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: 15.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

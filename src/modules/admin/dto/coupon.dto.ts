import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({ example: 'SAVE30', description: 'Unique promotional discount code' })
  @IsString()
  @IsNotEmpty({ message: 'Coupon code is required' })
  code: string;

  @ApiProperty({ example: 30.0, description: 'Percentage discount (1 - 100)' })
  @IsNumber()
  @Min(1, { message: 'Discount must be at least 1%' })
  @Max(100, { message: 'Discount cannot exceed 100%' })
  discountPercent: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ example: 500, default: 100, description: 'Maximum allowed redemptions' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxRedemptions?: number;
}

export class UpdateCouponDto {
  @ApiPropertyOptional({ example: 35.0, description: 'Updated discount percent' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: '2027-01-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxRedemptions?: number;
}

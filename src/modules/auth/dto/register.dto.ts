import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsNumber, Min, IsArray } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@smartmeal.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: 'Reazul' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Islam' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional({ example: 150.0 })
  @IsOptional()
  @IsNumber()
  @Min(50)
  weeklyBudget?: number;

  @ApiPropertyOptional({ example: ['Italian', 'Mexican'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisinePreferences?: string[];

  @ApiPropertyOptional({ example: ['Vegetarian', 'Gluten-Free'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryRestrictions?: string[];
}

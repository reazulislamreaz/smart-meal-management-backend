import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  IsNumber,
  Min,
} from 'class-validator';
import { Role } from '@prisma/client';

export class AdminCreateUserDto {
  @ApiProperty({ example: 'Admin User', description: 'Full Name' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @ApiProperty({ example: 'manager@smartmeal.com', description: 'Email address' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'TemporaryPassword123!', description: 'Initial password' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @ApiPropertyOptional({ example: Role.USER, enum: Role, default: Role.USER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+1987654321' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: Role.SUPER_ADMIN, enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: 175.0, description: 'Target weekly budget' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklyBudget?: number;

  @ApiPropertyOptional({ example: 'United Kingdom' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'London' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: '123 Baker Street, London, UK' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  isBlocked?: boolean;
}

export class UpdateUserRoleDto {
  @ApiProperty({ example: Role.SUPER_ADMIN, enum: Role, description: 'Role to assign' })
  @IsEnum(Role, { message: 'Invalid role' })
  @IsNotEmpty({ message: 'Role is required' })
  role: Role;
}

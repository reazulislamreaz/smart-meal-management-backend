import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'User Name / Full Name',
  })
  @IsString()
  @IsNotEmpty({ message: 'User Name is required' })
  fullName: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Alias for fullName',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Valid email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description: 'Single account password field (minimum 8 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Optional phone number',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Optional phone number alias',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'https://story-telling-bucket-s3.s3.eu-north-1.amazonaws.com/avatars/sample.jpg',
    description: 'Optional personal image / avatar URL',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    example: 'https://story-telling-bucket-s3.s3.eu-north-1.amazonaws.com/avatars/sample.jpg',
    description: 'Optional avatar URL alias',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

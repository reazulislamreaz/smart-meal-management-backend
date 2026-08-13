import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Registered user email address',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    example: '849201',
    description: '6-digit OTP code sent via email',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    example: '849201',
    description: '6-digit OTP token sent via email',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiProperty({
    example: 'NewSecurePassword123!',
    description: 'New password (minimum 8 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword: string;
}

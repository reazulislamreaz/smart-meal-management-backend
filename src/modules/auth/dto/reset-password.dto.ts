import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Registered user email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'NewSecurePassword123!',
    description: 'New password (minimum 8 characters)',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword: string;

  @ApiProperty({
    example: 'NewSecurePassword123!',
    description: 'Confirm new password (must match newPassword)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Confirm password is required' })
  @MinLength(8, { message: 'Confirm password must be at least 8 characters long' })
  confirmNewPassword: string;
}

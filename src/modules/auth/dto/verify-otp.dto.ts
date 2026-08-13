import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Registered user email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: '849201',
    description: '6-digit OTP code sent to user email',
  })
  @IsString()
  @IsNotEmpty({ message: '6-digit code is required' })
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  code: string;
}

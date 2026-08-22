import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'newemail@smartmeal.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 'Jane Smith' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ example: 'https://s3.amazonaws.com/avatar.jpg' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

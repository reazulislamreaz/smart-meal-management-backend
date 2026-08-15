import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpsertSettingDto {
  @ApiProperty({ example: 'defaultCurrency', description: 'Setting key name' })
  @IsString()
  @IsNotEmpty({ message: 'Setting key is required' })
  key: string;

  @ApiProperty({ example: 'GBP', description: 'Setting value' })
  @IsString()
  @IsNotEmpty({ message: 'Setting value is required' })
  value: string;

  @ApiPropertyOptional({ example: 'Default platform currency code' })
  @IsOptional()
  @IsString()
  description?: string;
}

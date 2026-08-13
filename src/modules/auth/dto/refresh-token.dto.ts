import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Raw refresh token string' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

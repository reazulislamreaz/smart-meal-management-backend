import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateSubscriberStatusDto {
  @ApiProperty({
    example: 'ACTIVE',
    enum: ['ACTIVE', 'CANCELED', 'EXPIRED', 'TRIALING'],
    description: 'New subscription account status',
  })
  @IsString()
  @IsNotEmpty({ message: 'Status is required' })
  status: string;
}

export class AssignSubscriptionDto {
  @ApiProperty({ example: 'user-uuid-1234', description: 'ID of target user' })
  @IsString()
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @ApiProperty({ example: 'Annual Plan', description: 'Name of the plan to assign' })
  @IsString()
  @IsNotEmpty({ message: 'Plan name is required' })
  planName: string;

  @ApiPropertyOptional({ example: 365, description: 'Duration in days (default: 30 for monthly, 365 for annual)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationDays?: number;
}

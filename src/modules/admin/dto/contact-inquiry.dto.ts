import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdateContactStatusDto {
  @ApiProperty({
    example: 'RESOLVED',
    enum: ['UNREAD', 'READ', 'RESOLVED'],
    description: 'Updated message status',
  })
  @IsString()
  @IsNotEmpty({ message: 'Status is required' })
  @IsIn(['UNREAD', 'READ', 'RESOLVED'], {
    message: 'Status must be one of: UNREAD, READ, RESOLVED',
  })
  status: string;
}

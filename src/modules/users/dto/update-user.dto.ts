import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { Role } from "@prisma/client";

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "newemail@smartmeal.com" })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: "NewPassword123!" })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: "Jane Smith" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ example: "https://s3.amazonaws.com/avatar.jpg" })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: "United States",
    description:
      'Country for regional currency calibration ("United States" / "US" or "United Kingdom" / "UK")',
    enum: ["United States", "United Kingdom", "US", "UK"],
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    example: "USD",
    description:
      'Currency code automatically derived from Country ("USD" for US, "GBP" for UK)',
    enum: ["USD", "GBP"],
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: "+1 123 456 7890" })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: "Chicago" })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: "123 Michigan Ave, Chicago, IL" })
  @IsString()
  @IsOptional()
  address?: string;
}

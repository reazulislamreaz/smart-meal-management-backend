import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, MinLength } from "class-validator";

export class UpsertSettingDto {
  @ApiProperty({ example: "defaultCurrency", description: "Setting key name" })
  @IsString()
  @IsNotEmpty({ message: "Setting key is required" })
  key: string;

  @ApiProperty({ example: "GBP", description: "Setting value" })
  @IsString()
  @IsNotEmpty({ message: "Setting value is required" })
  value: string;

  @ApiPropertyOptional({ example: "Default platform currency code" })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateAdminProfileDto {
  @ApiPropertyOptional({ example: "Bashar Islam" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "bashar.islam12@gmail.com" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "1819488101" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "USA" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "Admin" })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: "January" })
  @IsOptional()
  @IsString()
  memberSince?: string;

  @ApiPropertyOptional({ example: "https://i.pravatar.cc/96?img=12" })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class ChangeAdminPasswordDto {
  @ApiProperty({ example: "AdminPassword123!" })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: "NewSecurePassword123!" })
  @IsString()
  @MinLength(6, { message: "Password must be at least 6 characters" })
  newPassword: string;
}

export class UpdateAppConfigDto {
  @ApiPropertyOptional({ example: "7" })
  @IsOptional()
  @IsString()
  trialDays?: string;

  @ApiPropertyOptional({ example: "4" })
  @IsOptional()
  @IsString()
  defaultHousehold?: string;

  @ApiPropertyOptional({ example: "claude-sonnet-4-20250514" })
  @IsOptional()
  @IsString()
  aiModel?: string;

  @ApiPropertyOptional({ example: "6" })
  @IsOptional()
  @IsString()
  maxSuggestions?: string;

  @ApiPropertyOptional({
    example: {
      paywallHeadline: "Your free trial has ended",
      onboardingWelcome: "Let's build your first meal plan.",
      planCompleteMessage: "You cooked everything in this plan. Nice work.",
    },
  })
  @IsOptional()
  bannersCopy?: {
    paywallHeadline?: string;
    onboardingWelcome?: string;
    planCompleteMessage?: string;
    [key: string]: any;
  };
}

export class UpdateContactSettingsDto {
  @ApiPropertyOptional({ example: "hello@sizzl.com" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "+1 123 456 789" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "Get in touch with us" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "Dhaka, Bangladesh" })
  @IsOptional()
  @IsString()
  address?: string;
}

export class MealOptionDto {
  @ApiProperty({ example: "diet", enum: ["diet", "cuisine"] })
  @IsString()
  @IsNotEmpty()
  type: "diet" | "cuisine";

  @ApiProperty({ example: "Vegetarian" })
  @IsString()
  @IsNotEmpty()
  value: string;
}

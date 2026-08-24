import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const STATIC_PAGE_SLUGS = [
  'privacy-policy',
  'terms-and-conditions',
  'about-us',
] as const;

export const CONTENT_SLUGS = [...STATIC_PAGE_SLUGS, 'contact'] as const;

export type StaticPageSlug = (typeof STATIC_PAGE_SLUGS)[number];

export class CreateStaticPageDto {
  @ApiProperty({
    example: 'terms-and-conditions',
    enum: STATIC_PAGE_SLUGS,
    description: 'URL slug for the static page',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase kebab-case (e.g. terms-and-conditions)',
  })
  slug!: string;

  @ApiProperty({ example: 'Terms and Conditions', description: 'Page title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    example:
      'By using Sizzl you agree to these terms, including acceptable use of meal plans, subscriptions, and household features.',
    description: 'Full page body content',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdateStaticPageDto {
  @ApiProperty({ example: 'Privacy Policy', description: 'Page title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    example:
      'At Sizzl, we value your privacy and are committed to protecting your personal information.',
    description: 'Full page body content',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class SubmitContactDto {
  @ApiProperty({ example: 'Alex Taylor' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'alex@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ example: 'Question regarding AI plan' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({ example: 'How do I swap a dinner slot in my current plan?' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class StaticPageResponseDto {
  @ApiProperty({ example: 'privacy-policy' })
  slug!: string;

  @ApiProperty({ example: 'Privacy Policy' })
  title!: string;

  @ApiProperty({
    example: 'Smart Meal Management is committed to protecting your family privacy and personal dietary data.',
  })
  content!: string;

  @ApiProperty({ example: '2026-08-24T05:49:00.000Z' })
  updatedAt!: Date;
}

export class ContactInfoResponseDto {
  @ApiProperty({ example: 'contact' })
  slug!: string;

  @ApiProperty({ example: 'Contact us' })
  title!: string;

  @ApiProperty({ example: 'Support.info@gmail.com' })
  email!: string;

  @ApiProperty({ example: '+8801996655' })
  phone!: string;

  @ApiPropertyOptional({ example: 'Dhaka, Bangladesh' })
  address?: string;

  @ApiProperty({ example: '2026-08-24T05:49:00.000Z' })
  updatedAt!: Date;
}

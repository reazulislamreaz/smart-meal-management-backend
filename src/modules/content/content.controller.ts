import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { ContentService } from './content.service';
import { Public } from '@/common/decorators/public.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  CreateStaticPageDto,
  UpdateStaticPageDto,
  SubmitContactDto,
  StaticPageResponseDto,
  ContactInfoResponseDto,
  STATIC_PAGE_SLUGS,
  CONTENT_SLUGS,
} from './dto/content.dto';

@ApiTags('Content')
@ApiExtraModels(StaticPageResponseDto, ContactInfoResponseDto)
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // ==========================================
  // Public Static Pages & Contact Form
  // ==========================================
  @Public()
  @Get('content/:slug')
  @ApiOperation({
    summary: 'Get public static page content',
    description:
      'Fetch legal or informational page content by slug. Use `contact` to get Contact us email and phone. Built-in fallbacks exist for `privacy-policy`, `terms-and-conditions`, `about-us`, and `contact`.',
  })
  @ApiParam({
    name: 'slug',
    enum: CONTENT_SLUGS,
    example: 'contact',
    description: 'Static page slug or `contact` for Contact us info',
  })
  @ApiResponse({
    status: 200,
    description: 'Page content or contact info retrieved successfully',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(StaticPageResponseDto) },
        { $ref: getSchemaPath(ContactInfoResponseDto) },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Static page not found' })
  async getPage(@Param('slug') slug: string) {
    const page = await this.contentService.getStaticPage(slug);
    return {
      message: 'Page content retrieved successfully',
      data: page,
    };
  }

  @Public()
  @Post('contact')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit contact us / support form' })
  @ApiBody({ type: SubmitContactDto })
  @ApiResponse({ status: 200, description: 'Contact form submitted' })
  async submitContact(@Body() body: SubmitContactDto) {
    const result = await this.contentService.submitContactForm(body);
    return {
      message: result.message,
      data: result.data,
    };
  }

  // ==========================================
  // Admin CMS Static Pages Management
  // ==========================================
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/content')
  @ApiOperation({ summary: 'List all static pages (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Static pages retrieved successfully',
    type: [StaticPageResponseDto],
  })
  async listPages() {
    const pages = await this.contentService.listStaticPages();
    return {
      message: 'Static pages list retrieved successfully',
      data: pages,
    };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Post('admin/content')
  @ApiOperation({
    summary: 'Create a new static page (Admin)',
    description:
      'Create a CMS page. Typical slugs: `privacy-policy`, `terms-and-conditions`, `about-us`.',
  })
  @ApiBody({ type: CreateStaticPageDto })
  @ApiResponse({
    status: 201,
    description: 'Static page created successfully',
    type: StaticPageResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Static page slug already exists' })
  async createPage(@Body() body: CreateStaticPageDto) {
    const page = await this.contentService.createStaticPage(body.slug, body.title, body.content);
    return {
      message: 'Static page created successfully',
      data: page,
    };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/content/:slug')
  @ApiOperation({ summary: 'Get static page content (Admin)' })
  @ApiParam({
    name: 'slug',
    enum: STATIC_PAGE_SLUGS,
    example: 'terms-and-conditions',
    description: 'Static page slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Static page content retrieved successfully',
    type: StaticPageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Static page not found' })
  async getAdminPage(@Param('slug') slug: string) {
    const page = await this.contentService.getStaticPage(slug);
    return {
      message: 'Static page content retrieved successfully',
      data: page,
    };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Put('admin/content/:slug')
  @ApiOperation({
    summary: 'Edit static page content (Admin)',
    description:
      'Create or update a legal page. Use slugs `privacy-policy`, `terms-and-conditions`, or `about-us`.',
  })
  @ApiParam({
    name: 'slug',
    enum: STATIC_PAGE_SLUGS,
    example: 'privacy-policy',
    description: 'Static page slug',
  })
  @ApiBody({ type: UpdateStaticPageDto })
  @ApiResponse({
    status: 200,
    description: 'Static page updated successfully',
    type: StaticPageResponseDto,
  })
  async updatePage(@Param('slug') slug: string, @Body() body: UpdateStaticPageDto) {
    const page = await this.contentService.updateStaticPage(slug, body.title, body.content);
    return {
      message: 'Static page updated successfully',
      data: page,
    };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Delete('admin/content/:slug')
  @ApiOperation({ summary: 'Delete a static page (Admin)' })
  @ApiParam({
    name: 'slug',
    enum: STATIC_PAGE_SLUGS,
    example: 'about-us',
    description: 'Static page slug',
  })
  @ApiResponse({ status: 200, description: 'Static page deleted successfully' })
  @ApiResponse({ status: 404, description: 'Static page not found' })
  async deletePage(@Param('slug') slug: string) {
    const result = await this.contentService.deleteStaticPage(slug);
    return {
      message: result.message,
      data: result,
    };
  }
}

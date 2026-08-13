import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { Public } from '@/common/decorators/public.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Static Content & Support')
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get('content/:slug')
  @ApiOperation({ summary: 'Get static page content (privacy-policy, about-us)' })
  @ApiResponse({ status: 200, description: 'Static page content retrieved successfully' })
  async getPage(@Param('slug') slug: string) {
    const page = await this.contentService.getStaticPage(slug);
    return {
      message: 'Page content retrieved successfully',
      data: page,
    };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Put('admin/content/:slug')
  @ApiOperation({ summary: 'Edit static page content (Admin)' })
  @ApiResponse({ status: 200, description: 'Static page updated successfully' })
  async updatePage(
    @Param('slug') slug: string,
    @Body() body: { title: string; content: string },
  ) {
    const page = await this.contentService.updateStaticPage(slug, body.title, body.content);
    return {
      message: 'Static page updated successfully',
      data: page,
    };
  }

  @Public()
  @Post('contact')
  @ApiOperation({ summary: 'Submit contact us / support form' })
  @ApiResponse({ status: 200, description: 'Contact form submitted' })
  async submitContact(
    @Body() body: { name: string; email: string; message: string; subject?: string },
  ) {
    const result = await this.contentService.submitContactForm(body);
    return {
      message: result.message,
      data: result,
    };
  }
}

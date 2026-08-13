import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get platform gross revenue, subscriber counts, and MRR metrics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics() {
    const data = await this.adminService.getAnalytics();
    return {
      message: 'Platform analytics retrieved successfully',
      data,
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'List platform users with task completion rates and subscription tiers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Users list retrieved successfully' })
  async getUsers(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    const result = await this.adminService.listUsers(page, limit);
    return {
      message: 'Users list retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get detailed profile, assigned household, and billing history for a specific user' })
  @ApiResponse({ status: 200, description: 'User details retrieved successfully' })
  async getUserDetails(@Param('id') id: string) {
    const user = await this.adminService.getUserDetails(id);
    return {
      message: 'User details retrieved successfully',
      data: user,
    };
  }

  @Get('coupons')
  @ApiOperation({ summary: 'List all promotional coupon codes' })
  @ApiResponse({ status: 200, description: 'Coupons retrieved successfully' })
  async getCoupons() {
    const coupons = await this.adminService.getCoupons();
    return {
      message: 'Coupons retrieved successfully',
      data: coupons,
    };
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Create a new promotional coupon code' })
  @ApiResponse({ status: 201, description: 'Coupon created successfully' })
  async createCoupon(
    @Body() dto: { code: string; discountPercent: number; validUntil?: string; maxRedemptions?: number },
  ) {
    const coupon = await this.adminService.createCoupon(dto);
    return {
      message: 'Coupon created successfully',
      data: coupon,
    };
  }
}

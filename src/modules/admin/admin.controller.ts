import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
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

  // 1. Dashboard Overview Metrics & Activity Feed
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

  @Get('activities')
  @ApiOperation({ summary: 'Get recent platform activities feed' })
  @ApiResponse({ status: 200, description: 'Activities feed retrieved successfully' })
  async getActivities() {
    const data = await this.adminService.getRecentActivities();
    return {
      message: 'Recent activities feed retrieved successfully',
      data,
    };
  }

  // 2. User Management
  @Get('users')
  @ApiOperation({ summary: 'List platform users with task completion rates and subscription tiers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiResponse({ status: 200, description: 'Users list retrieved successfully' })
  async getUsers(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Query('search') search?: string,
    @Query('role') role?: Role,
  ) {
    const result = await this.adminService.listUsers(page, limit, search, role);
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

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role (SUPER_ADMIN or USER)' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    const updated = await this.adminService.updateUserRole(id, role);
    return {
      message: 'User role updated successfully',
      data: updated,
    };
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async deleteUser(@Param('id') id: string) {
    const result = await this.adminService.deleteUser(id);
    return {
      message: result.message,
      data: result,
    };
  }

  // 3. Master Recipe Catalog Management
  @Post('meals')
  @ApiOperation({ summary: 'Add a new recipe to master catalog' })
  @ApiResponse({ status: 201, description: 'Recipe created successfully' })
  async createMeal(@Body() dto: any) {
    const meal = await this.adminService.createMeal(dto);
    return {
      message: 'Recipe added to catalog successfully',
      data: meal,
    };
  }

  @Put('meals/:id')
  @ApiOperation({ summary: 'Update recipe in master catalog' })
  @ApiResponse({ status: 200, description: 'Recipe updated successfully' })
  async updateMeal(@Param('id') id: string, @Body() dto: any) {
    const meal = await this.adminService.updateMeal(id, dto);
    return {
      message: 'Recipe updated successfully',
      data: meal,
    };
  }

  @Delete('meals/:id')
  @ApiOperation({ summary: 'Delete recipe from master catalog' })
  @ApiResponse({ status: 200, description: 'Recipe deleted successfully' })
  async deleteMeal(@Param('id') id: string) {
    const result = await this.adminService.deleteMeal(id);
    return {
      message: result.message,
      data: result,
    };
  }

  // 4. Subscription Management
  @Get('subscriptions')
  @ApiOperation({ summary: 'Get subscriptions overview and MRR metrics' })
  @ApiResponse({ status: 200, description: 'Subscription overview retrieved successfully' })
  async getSubscriptionOverview() {
    const data = await this.adminService.getSubscriptionOverview();
    return {
      message: 'Subscription overview retrieved successfully',
      data,
    };
  }

  @Get('subscriptions/subscribers')
  @ApiOperation({ summary: 'List subscriber accounts with search, plan, and status filtering' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'planName', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Subscribers list retrieved successfully' })
  async getSubscribers(
    @Query('search') search?: string,
    @Query('planName') planName?: string,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    const result = await this.adminService.listSubscribers(page, limit, search, planName, status);
    return {
      message: 'Subscribers list retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  // 5. Earnings Analytics
  @Get('earnings')
  @ApiOperation({ summary: 'Get financial breakdowns and monthly revenue charts' })
  @ApiResponse({ status: 200, description: 'Earnings analytics retrieved successfully' })
  async getEarnings() {
    const data = await this.adminService.getEarningsAnalytics();
    return {
      message: 'Earnings analytics retrieved successfully',
      data,
    };
  }

  // 6. Promotional Coupons
  @Get('coupons')
  @ApiOperation({ summary: 'List promotional coupon codes with search and active status filter' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Coupons retrieved successfully' })
  async getCoupons(
    @Query('search') search?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    const coupons = await this.adminService.getCoupons(search, isActive);
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

  @Patch('coupons/:id/status')
  @ApiOperation({ summary: 'Toggle promotional coupon active/inactive status' })
  @ApiResponse({ status: 200, description: 'Coupon status toggled successfully' })
  async toggleCouponStatus(@Param('id') id: string) {
    const coupon = await this.adminService.toggleCouponStatus(id);
    return {
      message: `Coupon status toggled to ${coupon.isActive ? 'ACTIVE' : 'INACTIVE'}`,
      data: coupon,
    };
  }

  @Delete('coupons/:id')
  @ApiOperation({ summary: 'Delete promotional coupon' })
  @ApiResponse({ status: 200, description: 'Coupon deleted successfully' })
  async deleteCoupon(@Param('id') id: string) {
    const result = await this.adminService.deleteCoupon(id);
    return {
      message: result.message,
      data: result,
    };
  }
}

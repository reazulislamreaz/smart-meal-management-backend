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
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto';
import {
  AssignSubscriptionDto,
  UpdateSubscriberStatusDto,
} from './dto/subscriber-management.dto';
import {
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto';
import {
  CreateAdminMealDto,
  UpdateAdminMealDto,
} from './dto/admin-meal.dto';
import {
  AdminCreateUserDto,
  AdminUpdateUserDto,
  UpdateUserRoleDto,
} from './dto/admin-user.dto';
import { UpdateContactStatusDto } from './dto/contact-inquiry.dto';
import { UpsertSettingDto } from './dto/system-settings.dto';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==========================================
  // 1. Dashboard Overview Metrics & Activity Feed
  // ==========================================
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

  // ==========================================
  // 2. User Management & Moderation
  // ==========================================
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

  @Post('users')
  @ApiOperation({ summary: 'Create a new user account (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(@Body() dto: AdminCreateUserDto) {
    const user = await this.adminService.createUser(dto);
    return {
      message: 'User created successfully',
      data: user,
    };
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user profile (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    const user = await this.adminService.updateUser(id, dto);
    return {
      message: 'User profile updated successfully',
      data: user,
    };
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role (SUPER_ADMIN or USER)' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const updated = await this.adminService.updateUserRole(id, dto.role);
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

  // ==========================================
  // 3. Subscription Pricing Plans Management
  // ==========================================
  @Get('subscription-plans')
  @ApiOperation({ summary: 'List all subscription pricing plans with active subscriber counts' })
  @ApiResponse({ status: 200, description: 'Subscription plans retrieved successfully' })
  async listSubscriptionPlans() {
    const plans = await this.adminService.listSubscriptionPlans();
    return {
      message: 'Subscription plans retrieved successfully',
      data: plans,
    };
  }

  @Get('subscription-plans/:id')
  @ApiOperation({ summary: 'Get specific subscription pricing plan details' })
  @ApiResponse({ status: 200, description: 'Subscription plan retrieved successfully' })
  async getSubscriptionPlan(@Param('id') id: string) {
    const plan = await this.adminService.getSubscriptionPlan(id);
    return {
      message: 'Subscription plan retrieved successfully',
      data: plan,
    };
  }

  @Post('subscription-plans')
  @ApiOperation({ summary: 'Create a new subscription pricing plan tier' })
  @ApiResponse({ status: 201, description: 'Subscription plan created successfully' })
  async createSubscriptionPlan(@Body() dto: CreateSubscriptionPlanDto) {
    const plan = await this.adminService.createSubscriptionPlan(dto);
    return {
      message: 'Subscription plan created successfully',
      data: plan,
    };
  }

  @Put('subscription-plans/:id')
  @ApiOperation({ summary: 'Update an existing subscription pricing plan' })
  @ApiResponse({ status: 200, description: 'Subscription plan updated successfully' })
  async updateSubscriptionPlan(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    const plan = await this.adminService.updateSubscriptionPlan(id, dto);
    return {
      message: 'Subscription plan updated successfully',
      data: plan,
    };
  }

  @Patch('subscription-plans/:id/status')
  @ApiOperation({ summary: 'Toggle subscription pricing plan active/inactive status' })
  @ApiResponse({ status: 200, description: 'Subscription plan status toggled' })
  async toggleSubscriptionPlanStatus(@Param('id') id: string) {
    const plan = await this.adminService.toggleSubscriptionPlanStatus(id);
    return {
      message: `Subscription plan is now ${plan.isActive ? 'ACTIVE' : 'INACTIVE'}`,
      data: plan,
    };
  }

  @Delete('subscription-plans/:id')
  @ApiOperation({ summary: 'Delete a subscription pricing plan' })
  @ApiResponse({ status: 200, description: 'Subscription plan deleted successfully' })
  async deleteSubscriptionPlan(@Param('id') id: string) {
    const result = await this.adminService.deleteSubscriptionPlan(id);
    return {
      message: result.message,
      data: result,
    };
  }

  // ==========================================
  // 4. Subscriber Management
  // ==========================================
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

  @Patch('subscriptions/:id/status')
  @ApiOperation({ summary: 'Update subscriber account status (ACTIVE, CANCELED, EXPIRED, TRIALING)' })
  @ApiResponse({ status: 200, description: 'Subscriber status updated successfully' })
  async updateSubscriberStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriberStatusDto,
  ) {
    const sub = await this.adminService.updateSubscriberStatus(id, dto.status);
    return {
      message: 'Subscriber status updated successfully',
      data: sub,
    };
  }

  @Post('subscriptions/assign')
  @ApiOperation({ summary: 'Manually assign or extend a subscription plan for a user' })
  @ApiResponse({ status: 201, description: 'Subscription assigned successfully' })
  async assignSubscription(@Body() dto: AssignSubscriptionDto) {
    const sub = await this.adminService.assignSubscription(dto);
    return {
      message: 'Subscription assigned successfully',
      data: sub,
    };
  }

  @Delete('subscriptions/:id')
  @ApiOperation({ summary: 'Cancel a subscriber account subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled successfully' })
  async cancelSubscription(@Param('id') id: string) {
    const sub = await this.adminService.cancelSubscription(id);
    return {
      message: 'Subscription canceled successfully',
      data: sub,
    };
  }

  // ==========================================
  // 5. Master Recipe Catalog Management
  // ==========================================
  @Get('meals')
  @ApiOperation({ summary: 'List recipes in master catalog with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'cuisine', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Meals retrieved successfully' })
  async listMeals(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Query('search') search?: string,
    @Query('cuisine') cuisine?: string,
  ) {
    const result = await this.adminService.listMeals(page, limit, search, cuisine);
    return {
      message: 'Meals retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('meals/:id')
  @ApiOperation({ summary: 'Get recipe details by ID' })
  @ApiResponse({ status: 200, description: 'Meal retrieved successfully' })
  async getMeal(@Param('id') id: string) {
    const meal = await this.adminService.getMeal(id);
    return {
      message: 'Meal retrieved successfully',
      data: meal,
    };
  }

  @Post('meals')
  @ApiOperation({ summary: 'Add a new recipe to master catalog' })
  @ApiResponse({ status: 201, description: 'Recipe created successfully' })
  async createMeal(@Body() dto: CreateAdminMealDto) {
    const meal = await this.adminService.createMeal(dto);
    return {
      message: 'Recipe added to catalog successfully',
      data: meal,
    };
  }

  @Put('meals/:id')
  @ApiOperation({ summary: 'Update recipe in master catalog' })
  @ApiResponse({ status: 200, description: 'Recipe updated successfully' })
  async updateMeal(@Param('id') id: string, @Body() dto: UpdateAdminMealDto) {
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

  // ==========================================
  // 6. Promotional Coupons
  // ==========================================
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

  @Get('coupons/:id')
  @ApiOperation({ summary: 'Get coupon details and redemption history' })
  @ApiResponse({ status: 200, description: 'Coupon details retrieved successfully' })
  async getCoupon(@Param('id') id: string) {
    const coupon = await this.adminService.getCoupon(id);
    return {
      message: 'Coupon retrieved successfully',
      data: coupon,
    };
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Create a new promotional coupon code' })
  @ApiResponse({ status: 201, description: 'Coupon created successfully' })
  async createCoupon(@Body() dto: CreateCouponDto) {
    const coupon = await this.adminService.createCoupon(dto);
    return {
      message: 'Coupon created successfully',
      data: coupon,
    };
  }

  @Put('coupons/:id')
  @ApiOperation({ summary: 'Update promotional coupon code settings' })
  @ApiResponse({ status: 200, description: 'Coupon updated successfully' })
  async updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const coupon = await this.adminService.updateCoupon(id, dto);
    return {
      message: 'Coupon updated successfully',
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

  // ==========================================
  // 7. Contact / Support Inquiries Management
  // ==========================================
  @Get('contacts')
  @ApiOperation({ summary: 'List user contact messages and support inquiries' })
  @ApiQuery({ name: 'status', required: false, enum: ['UNREAD', 'READ', 'RESOLVED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Contact messages retrieved successfully' })
  async listContactMessages(
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    const result = await this.adminService.listContactMessages(status, page, limit);
    return {
      message: 'Contact messages retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('contacts/:id')
  @ApiOperation({ summary: 'Get contact message by ID' })
  @ApiResponse({ status: 200, description: 'Contact message retrieved successfully' })
  async getContactMessage(@Param('id') id: string) {
    const message = await this.adminService.getContactMessage(id);
    return {
      message: 'Contact message retrieved successfully',
      data: message,
    };
  }

  @Patch('contacts/:id/status')
  @ApiOperation({ summary: 'Update contact inquiry status (READ / RESOLVED)' })
  @ApiResponse({ status: 200, description: 'Contact message status updated' })
  async updateContactStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactStatusDto,
  ) {
    const message = await this.adminService.updateContactStatus(id, dto.status);
    return {
      message: 'Contact message status updated successfully',
      data: message,
    };
  }

  @Delete('contacts/:id')
  @ApiOperation({ summary: 'Delete contact message' })
  @ApiResponse({ status: 200, description: 'Contact message deleted successfully' })
  async deleteContactMessage(@Param('id') id: string) {
    const result = await this.adminService.deleteContactMessage(id);
    return {
      message: result.message,
      data: result,
    };
  }

  // ==========================================
  // 8. Platform System Settings
  // ==========================================
  @Get('settings')
  @ApiOperation({ summary: 'Get global platform settings' })
  @ApiResponse({ status: 200, description: 'Platform settings retrieved successfully' })
  async getSettings() {
    const settings = await this.adminService.getSettings();
    return {
      message: 'Platform settings retrieved successfully',
      data: settings,
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update or set a platform setting' })
  @ApiResponse({ status: 200, description: 'Platform setting updated successfully' })
  async updateSetting(@Body() dto: UpsertSettingDto) {
    const setting = await this.adminService.upsertSetting(dto);
    return {
      message: `Setting "${dto.key}" updated successfully`,
      data: setting,
    };
  }

  // ==========================================
  // 9. Audit Logs
  // ==========================================
  @Get('audit-logs')
  @ApiOperation({ summary: 'Get administrative security audit trail logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    const result = await this.adminService.getAuditLogs(page, limit);
    return {
      message: 'Audit logs retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }
}

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get active subscription status for user' })
  @ApiResponse({ status: 200, description: 'Subscription details retrieved successfully' })
  async getCurrent(@CurrentUser('id') userId: string) {
    const sub = await this.subscriptionsService.getCurrentSubscription(userId);
    return {
      message: 'Subscription status retrieved successfully',
      data: sub,
    };
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Subscribe or upgrade user subscription plan' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  async checkout(
    @CurrentUser('id') userId: string,
    @Body() body: { planName: 'Monthly Premium' | 'Annual Plan'; couponCode?: string },
  ) {
    const result = await this.subscriptionsService.checkoutPlan(userId, body.planName, body.couponCode);
    return {
      message: 'Subscription updated successfully',
      data: result,
    };
  }

  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validate promotional coupon code' })
  @ApiResponse({ status: 200, description: 'Coupon valid' })
  async validateCoupon(
    @CurrentUser('id') userId: string,
    @Body('code') code: string,
  ) {
    const result = await this.subscriptionsService.validateCoupon(userId, code);
    return {
      message: 'Coupon is valid',
      data: result,
    };
  }
}

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailablePlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async getCurrentSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      return {
        planName: 'Free Trial',
        status: 'ACTIVE',
        isTrial: true,
        currentPeriodEnd: null,
      };
    }

    return sub;
  }

  async checkoutPlan(userId: string, planName: 'Monthly Premium' | 'Annual Plan', couponCode?: string) {
    let discountPercent = 0;

    if (couponCode) {
      const coupon = await this.validateCoupon(userId, couponCode);
      discountPercent = coupon.discountPercent;
    }

    const price = planName === 'Annual Plan' ? 59.88 : 7.99;
    const finalPrice = Number((price * (1 - discountPercent / 100)).toFixed(2));

    const periodEnd = new Date();
    if (planName === 'Annual Plan') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        planName,
        status: 'ACTIVE',
        currentPeriodEnd: periodEnd,
      },
    });

    if (couponCode) {
      const coupon = await this.prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
      if (coupon) {
        await this.prisma.couponRedemption.create({
          data: { couponId: coupon.id, userId },
        });
      }
    }

    return {
      subscription: sub,
      pricing: {
        originalPrice: price,
        discountPercent,
        finalPricePaid: finalPrice,
      },
    };
  }

  async validateCoupon(userId: string, code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
      include: { redemptions: true },
    });

    if (!coupon || !coupon.isActive) {
      throw new NotFoundException('Invalid or inactive coupon code');
    }

    if (coupon.validUntil && coupon.validUntil < new Date()) {
      throw new BadRequestException('Coupon code has expired');
    }

    if (coupon.redemptions.length >= coupon.maxRedemptions) {
      throw new BadRequestException('Coupon redemption limit reached');
    }

    const alreadyRedeemed = coupon.redemptions.some((r) => r.userId === userId);
    if (alreadyRedeemed) {
      throw new BadRequestException('You have already used this coupon code');
    }

    return {
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
    };
  }
}

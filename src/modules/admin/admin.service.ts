import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics() {
    const [totalUsers, activeSubscriptions, totalMeals, totalCoupons] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.meal.count(),
      this.prisma.coupon.count(),
    ]);

    const grossRevenue = activeSubscriptions * 59.88;
    const netMRR = activeSubscriptions * 7.99;
    const churnRate = 1.2;

    return {
      totalUsers,
      activeSubscriptions,
      grossRevenue,
      netMRR,
      churnRate: `${churnRate}%`,
      totalMeals,
      totalCoupons,
    };
  }

  async listUsers(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tasks: { select: { status: true } },
          subscriptions: { select: { planName: true, status: true } },
        },
      }),
      this.prisma.user.count(),
    ]);

    const formattedUsers = users.map((u) => {
      const completedTasks = u.tasks.filter((t) => t.status === 'COMPLETED').length;
      const totalTasks = u.tasks.length;
      const taskCompletionRate = totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : 'N/A';

      return {
        id: u.id,
        email: u.email,
        name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        role: u.role,
        weeklyBudget: u.weeklyBudget,
        taskCompletionRate,
        plan: u.subscriptions[0]?.planName || 'Free Trial',
        createdAt: u.createdAt,
      };
    });

    return {
      data: formattedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        mealPlans: { take: 5, orderBy: { createdAt: 'desc' } },
        pantryItems: true,
        tasks: true,
        subscriptions: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async getCoupons() {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    return coupons;
  }

  async createCoupon(dto: {
    code: string;
    discountPercent: number;
    validUntil?: string;
    maxRedemptions?: number;
  }) {
    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        discountPercent: dto.discountPercent,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        maxRedemptions: dto.maxRedemptions || 100,
        isActive: true,
      },
    });

    return coupon;
  }
}

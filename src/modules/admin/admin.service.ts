import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Dashboard Overview Metrics & Recent Activity Feed (Route: /)
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

  async getRecentActivities() {
    const [recentUsers, recentSubs, recentLogs] = await Promise.all([
      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, createdAt: true },
      }),
      this.prisma.subscription.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } },
      }),
      this.prisma.cookbookLog.findMany({
        take: 5,
        orderBy: { cookedAt: 'desc' },
        include: { user: { select: { email: true, name: true } }, meal: { select: { title: true } } },
      }),
    ]);

    const activities = [
      ...recentUsers.map((u) => ({
        type: 'USER_REGISTERED',
        description: `New user signed up: ${u.email}`,
        timestamp: u.createdAt,
      })),
      ...recentSubs.map((s) => ({
        type: 'SUBSCRIPTION_CHECKOUT',
        description: `${s.user.email} subscribed to ${s.planName}`,
        timestamp: s.createdAt,
      })),
      ...recentLogs.map((l) => ({
        type: 'MEAL_COOKED',
        description: `${l.user.email} cooked "${l.meal.title}"`,
        timestamp: l.cookedAt,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

    return activities;
  }

  // 2. User Management (Route: /users & /users/:id)
  async listUsers(page = 1, limit = 10, search?: string, roleFilter?: Role) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (roleFilter) {
      where.role = roleFilter;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tasks: { select: { status: true } },
          subscriptions: { select: { planName: true, status: true } },
        },
      }),
      this.prisma.user.count({ where }),
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

  async updateUserRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    return updated;
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: `User "${user.email}" deleted successfully` };
  }

  // 3. Master Recipe Catalog Management (Route: /meals)
  async createMeal(dto: {
    title: string;
    description?: string;
    prepTimeMinutes?: number;
    servings?: number;
    estimatedCost?: number;
    cuisine?: string;
    dietaryTags?: string[];
    instructions?: string[];
    ingredients?: any[];
    imageUrl?: string;
  }) {
    const meal = await this.prisma.meal.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        prepTimeMinutes: dto.prepTimeMinutes || 15,
        servings: dto.servings || 4,
        estimatedCost: dto.estimatedCost || 15.0,
        cuisine: dto.cuisine || 'American',
        dietaryTags: dto.dietaryTags || [],
        instructions: dto.instructions || [],
        ingredients: dto.ingredients || [],
        imageUrl: dto.imageUrl || null,
      },
    });
    return meal;
  }

  async updateMeal(id: string, dto: any) {
    const existing = await this.prisma.meal.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Meal with ID "${id}" not found`);
    }

    const updated = await this.prisma.meal.update({
      where: { id },
      data: dto,
    });

    return updated;
  }

  async deleteMeal(id: string) {
    const existing = await this.prisma.meal.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Meal with ID "${id}" not found`);
    }

    await this.prisma.meal.delete({ where: { id } });
    return { success: true, message: `Meal "${existing.title}" removed from catalog` };
  }

  // 4. Subscriptions Overview & Subscriber List (Route: /subscription)
  async getSubscriptionOverview() {
    const [totalSubs, activeMonthly, activeAnnual, canceled] = await Promise.all([
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where: { planName: 'Monthly Premium', status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { planName: 'Annual Plan', status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { status: 'CANCELED' } }),
    ]);

    return {
      totalSubscriptions: totalSubs,
      activeMonthly,
      activeAnnual,
      canceledCount: canceled,
      mrr: (activeMonthly * 7.99 + activeAnnual * 4.99).toFixed(2),
    };
  }

  async listSubscribers(
    page = 1,
    limit = 10,
    search?: string,
    planName?: string,
    status?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (planName) {
      where.planName = { equals: planName, mode: 'insensitive' };
    }
    if (status) {
      where.status = { equals: status, mode: 'insensitive' };
    }
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [subscribers, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data: subscribers,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // 5. Earnings Analytics & Financial Breakdowns (Route: /earnings)
  async getEarningsAnalytics() {
    const activeSubs = await this.prisma.subscription.count({ where: { status: 'ACTIVE' } });
    const redemptions = await this.prisma.couponRedemption.count();

    const grossRevenue = activeSubs * 59.88;
    const netRevenue = grossRevenue * 0.95; // 5% processing reserve

    const monthlyBreakdown = [
      { month: 'Jan', revenue: 1200 },
      { month: 'Feb', revenue: 1800 },
      { month: 'Mar', revenue: 2400 },
      { month: 'Apr', revenue: 3100 },
      { month: 'May', revenue: grossRevenue },
    ];

    return {
      grossRevenue,
      netRevenue,
      couponDiscountsApplied: redemptions * 10.0,
      monthlyBreakdown,
    };
  }

  // 6. Coupons Management (Route: /coupons)
  async getCoupons(search?: string, isActive?: boolean) {
    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.code = { contains: search.toUpperCase(), mode: 'insensitive' };
    }

    const coupons = await this.prisma.coupon.findMany({
      where,
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
    const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existing) {
      throw new BadRequestException(`Coupon code "${dto.code.toUpperCase()}" already exists`);
    }

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

  async toggleCouponStatus(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID "${id}" not found`);
    }

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive },
    });

    return updated;
  }

  async deleteCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID "${id}" not found`);
    }

    await this.prisma.coupon.delete({ where: { id } });
    return { success: true, message: `Coupon "${coupon.code}" deleted` };
  }
}

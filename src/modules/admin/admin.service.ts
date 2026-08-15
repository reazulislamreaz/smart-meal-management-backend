import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Role } from '@prisma/client';

export interface CreateSubscriptionPlanDto {
  name: string;
  description?: string;
  price: number;
  interval?: string;
  currency?: string;
  features?: string[];
  discountPercent?: number;
  isPopular?: boolean;
  isActive?: boolean;
}

export interface UpdateSubscriptionPlanDto {
  name?: string;
  description?: string;
  price?: number;
  interval?: string;
  currency?: string;
  features?: string[];
  discountPercent?: number;
  isPopular?: boolean;
  isActive?: boolean;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // 1. Dashboard Overview Metrics & Activity Feed
  // ==========================================
  async getAnalytics() {
    const [totalUsers, activeSubscriptions, totalMeals, totalCoupons, totalPlans] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        this.prisma.meal.count(),
        this.prisma.coupon.count(),
        this.prisma.subscriptionPlan.count(),
      ]);

    const grossRevenue = activeSubscriptions * 59.88;
    const netMRR = activeSubscriptions * 7.99;
    const churnRate = 1.2;

    return {
      totalUsers,
      activeSubscriptions,
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      netMRR: Math.round(netMRR * 100) / 100,
      churnRate: `${churnRate}%`,
      totalMeals,
      totalCoupons,
      totalPlans,
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
        include: {
          user: { select: { email: true, name: true } },
          meal: { select: { title: true } },
        },
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
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return activities;
  }

  // ==========================================
  // 2. User Management
  // ==========================================
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
      const { passwordHash, ...sanitized } = u;
      const totalTasks = u.tasks.length;
      const completedTasks = u.tasks.filter((t) => t.status === 'COMPLETED').length;
      const taskCompletionRate =
        totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : 'N/A';
      const activeSubscription = u.subscriptions.find((s) => s.status === 'ACTIVE');

      return {
        ...sanitized,
        taskCompletionRate,
        currentPlan: activeSubscription ? activeSubscription.planName : 'Free Tier',
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
        subscriptions: { orderBy: { createdAt: 'desc' } },
        pantryItems: { take: 10, orderBy: { createdAt: 'desc' } },
        tasks: { take: 10, orderBy: { createdAt: 'desc' } },
        cookbookLogs: {
          take: 5,
          orderBy: { cookedAt: 'desc' },
          include: { meal: { select: { title: true } } },
        },
        auditLogs: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async updateUserRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
    });

    const { passwordHash, ...result } = updated;
    return result;
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: `User "${user.email}" deleted successfully` };
  }

  // ==========================================
  // 3. Subscription Pricing Plans Management (NEW)
  // ==========================================
  async listSubscriptionPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });

    // Count subscribers for each plan
    const subCounts = await this.prisma.subscription.groupBy({
      by: ['planName'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
    });
    const countMap = new Map(subCounts.map((c) => [c.planName, c._count.id]));

    return plans.map((p) => ({
      ...p,
      activeSubscribersCount: countMap.get(p.name) || 0,
    }));
  }

  async getSubscriptionPlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID "${id}" not found`);
    }
    return plan;
  }

  async createSubscriptionPlan(dto: CreateSubscriptionPlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(`Subscription plan "${dto.name}" already exists`);
    }

    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name.trim(),
        description: dto.description || null,
        price: Number(dto.price),
        interval: dto.interval || 'monthly',
        currency: dto.currency || 'USD',
        features: dto.features || [],
        discountPercent: dto.discountPercent !== undefined ? Number(dto.discountPercent) : 0.0,
        isPopular: dto.isPopular || false,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateSubscriptionPlan(id: string, dto: UpdateSubscriptionPlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID "${id}" not found`);
    }

    if (dto.name && dto.name.trim() !== plan.name) {
      const existing = await this.prisma.subscriptionPlan.findUnique({
        where: { name: dto.name.trim() },
      });
      if (existing) {
        throw new ConflictException(`Another subscription plan with name "${dto.name}" already exists`);
      }
    }

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        price: dto.price !== undefined ? Number(dto.price) : undefined,
        interval: dto.interval,
        currency: dto.currency,
        features: dto.features,
        discountPercent: dto.discountPercent !== undefined ? Number(dto.discountPercent) : undefined,
        isPopular: dto.isPopular,
        isActive: dto.isActive,
      },
    });
  }

  async toggleSubscriptionPlanStatus(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID "${id}" not found`);
    }

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: !plan.isActive },
    });
  }

  async deleteSubscriptionPlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID "${id}" not found`);
    }

    await this.prisma.subscriptionPlan.delete({ where: { id } });
    return { success: true, message: `Subscription plan "${plan.name}" deleted successfully` };
  }

  // ==========================================
  // 4. Subscriber Management
  // ==========================================
  async getSubscriptionOverview() {
    const [totalSubs, activeSubs, monthlySubs, annualSubs] = await Promise.all([
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({
        where: { status: 'ACTIVE', planName: { contains: 'Monthly', mode: 'insensitive' } },
      }),
      this.prisma.subscription.count({
        where: { status: 'ACTIVE', planName: { contains: 'Annual', mode: 'insensitive' } },
      }),
    ]);

    return {
      totalSubscriptions: totalSubs,
      activeSubscriptions: activeSubs,
      monthlySubscribers: monthlySubs,
      annualSubscribers: annualSubs,
      retentionRate: totalSubs > 0 ? `${Math.round((activeSubs / totalSubs) * 100)}%` : '100%',
    };
  }

  async listSubscribers(
    page = 1,
    limit = 10,
    search?: string,
    planFilter?: string,
    statusFilter?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (statusFilter) {
      where.status = statusFilter.toUpperCase();
    }
    if (planFilter) {
      where.planName = { contains: planFilter, mode: 'insensitive' };
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
          user: {
            select: { id: true, email: true, name: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data: subscribers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateSubscriberStatus(id: string, status: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription with ID "${id}" not found`);
    }

    return this.prisma.subscription.update({
      where: { id },
      data: { status: status.toUpperCase() },
      include: { user: { select: { email: true } } },
    });
  }

  async assignSubscription(dto: { userId: string; planName: string; durationDays?: number }) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${dto.userId}" not found`);
    }

    const duration = dto.durationDays || (dto.planName.toLowerCase().includes('annual') ? 365 : 30);
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + duration);

    return this.prisma.subscription.create({
      data: {
        userId: dto.userId,
        planName: dto.planName,
        status: 'ACTIVE',
        currentPeriodEnd: periodEnd,
      },
      include: { user: { select: { email: true, name: true } } },
    });
  }

  async cancelSubscription(id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription with ID "${id}" not found`);
    }

    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
  }

  // ==========================================
  // 5. Master Recipe Catalog Management
  // ==========================================
  async listMeals(page = 1, limit = 10, search?: string, cuisine?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (cuisine) {
      where.cuisine = { equals: cuisine, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [meals, total] = await Promise.all([
      this.prisma.meal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.meal.count({ where }),
    ]);

    return {
      data: meals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMeal(id: string) {
    const meal = await this.prisma.meal.findUnique({ where: { id } });
    if (!meal) {
      throw new NotFoundException(`Meal with ID "${id}" not found`);
    }
    return meal;
  }

  async createMeal(dto: any) {
    return this.prisma.meal.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        prepTimeMinutes: Number(dto.prepTimeMinutes) || 15,
        servings: Number(dto.servings) || 4,
        estimatedCost: Number(dto.estimatedCost) || 15.0,
        cuisine: dto.cuisine || 'American',
        dietaryTags: dto.dietaryTags || [],
        instructions: dto.instructions || [],
        ingredients: dto.ingredients || [],
        imageUrl: dto.imageUrl || null,
      },
    });
  }

  async updateMeal(id: string, dto: any) {
    const meal = await this.prisma.meal.findUnique({ where: { id } });
    if (!meal) {
      throw new NotFoundException(`Meal with ID "${id}" not found`);
    }

    return this.prisma.meal.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        prepTimeMinutes: dto.prepTimeMinutes !== undefined ? Number(dto.prepTimeMinutes) : undefined,
        servings: dto.servings !== undefined ? Number(dto.servings) : undefined,
        estimatedCost: dto.estimatedCost !== undefined ? Number(dto.estimatedCost) : undefined,
        cuisine: dto.cuisine,
        dietaryTags: dto.dietaryTags,
        instructions: dto.instructions,
        ingredients: dto.ingredients,
        imageUrl: dto.imageUrl,
      },
    });
  }

  async deleteMeal(id: string) {
    const meal = await this.prisma.meal.findUnique({ where: { id } });
    if (!meal) {
      throw new NotFoundException(`Meal with ID "${id}" not found`);
    }

    await this.prisma.meal.delete({ where: { id } });
    return { success: true, message: `Recipe "${meal.title}" deleted successfully` };
  }

  // ==========================================
  // 6. Promotional Coupons Management
  // ==========================================
  async getCoupons(search?: string, isActive?: boolean) {
    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.code = { contains: search, mode: 'insensitive' };
    }

    return this.prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    });
  }

  async getCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        redemptions: {
          include: { user: { select: { email: true, name: true } } },
          orderBy: { redeemedAt: 'desc' },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID "${id}" not found`);
    }
    return coupon;
  }

  async createCoupon(dto: {
    code: string;
    discountPercent: number;
    validUntil?: string;
    maxRedemptions?: number;
  }) {
    const existing = await this.prisma.coupon.findUnique({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Coupon code "${dto.code}" already exists`);
    }

    return this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        discountPercent: Number(dto.discountPercent),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        maxRedemptions: dto.maxRedemptions !== undefined ? Number(dto.maxRedemptions) : 100,
        isActive: true,
      },
    });
  }

  async updateCoupon(
    id: string,
    dto: { discountPercent?: number; validUntil?: string; maxRedemptions?: number },
  ) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID "${id}" not found`);
    }

    return this.prisma.coupon.update({
      where: { id },
      data: {
        discountPercent:
          dto.discountPercent !== undefined ? Number(dto.discountPercent) : undefined,
        validUntil: dto.validUntil !== undefined ? (dto.validUntil ? new Date(dto.validUntil) : null) : undefined,
        maxRedemptions:
          dto.maxRedemptions !== undefined ? Number(dto.maxRedemptions) : undefined,
      },
    });
  }

  async toggleCouponStatus(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID "${id}" not found`);
    }

    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive },
    });
  }

  async deleteCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID "${id}" not found`);
    }

    await this.prisma.coupon.delete({ where: { id } });
    return { success: true, message: `Coupon "${coupon.code}" deleted successfully` };
  }

  // ==========================================
  // 7. Contact / Feedback Messages Management (NEW)
  // ==========================================
  async listContactMessages(status?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) {
      where.status = status.toUpperCase();
    }

    const [messages, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactMessage.count({ where }),
    ]);

    return {
      data: messages,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getContactMessage(id: string) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!message) {
      throw new NotFoundException(`Contact message with ID "${id}" not found`);
    }
    return message;
  }

  async updateContactStatus(id: string, status: string) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!message) {
      throw new NotFoundException(`Contact message with ID "${id}" not found`);
    }

    return this.prisma.contactMessage.update({
      where: { id },
      data: { status: status.toUpperCase() },
    });
  }

  async deleteContactMessage(id: string) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!message) {
      throw new NotFoundException(`Contact message with ID "${id}" not found`);
    }

    await this.prisma.contactMessage.delete({ where: { id } });
    return { success: true, message: 'Contact message deleted successfully' };
  }

  // ==========================================
  // 8. Financial Earnings Analytics
  // ==========================================
  async getEarningsAnalytics() {
    const activeSubs = await this.prisma.subscription.count({ where: { status: 'ACTIVE' } });
    const monthlyTotal = activeSubs * 7.99;
    const annualTotal = activeSubs * 59.88;

    return {
      totalGrossRevenue: Math.round((monthlyTotal + annualTotal) * 100) / 100,
      monthlyRecurringRevenue: Math.round(monthlyTotal * 100) / 100,
      annualRecurringRevenue: Math.round(annualTotal * 100) / 100,
      chartData: [
        { month: 'Jan', revenue: 1250 },
        { month: 'Feb', revenue: 1890 },
        { month: 'Mar', revenue: 2340 },
        { month: 'Apr', revenue: 2780 },
        { month: 'May', revenue: 3450 },
        { month: 'Jun', revenue: 4120 },
      ],
    };
  }

  // ==========================================
  // 9. Platform System Settings (NEW)
  // ==========================================
  async getSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    return {
      appName: settingsMap['appName'] || 'Smart Meal Management',
      defaultCurrency: settingsMap['defaultCurrency'] || 'USD',
      freeTrialDays: Number(settingsMap['freeTrialDays'] || 14),
      maintenanceMode: settingsMap['maintenanceMode'] === 'true',
      all: settings,
    };
  }

  async upsertSetting(key: string, value: string, description?: string) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });
  }

  // ==========================================
  // 10. Audit Logs
  // ==========================================
  async getAuditLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

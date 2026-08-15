import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto';
import {
  AssignSubscriptionDto,
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
} from './dto/admin-user.dto';
import {
  UpsertSettingDto,
  UpdateAdminProfileDto,
  ChangeAdminPasswordDto,
  UpdateAppConfigDto,
  UpdateContactSettingsDto,
} from './dto/system-settings.dto';

const DEFAULT_AVATARS = [
  'https://i.pravatar.cc/96?img=12',
  'https://i.pravatar.cc/96?img=32',
  'https://i.pravatar.cc/96?img=47',
  'https://i.pravatar.cc/96?img=5',
  'https://i.pravatar.cc/96?img=11',
  'https://i.pravatar.cc/96?img=15',
  'https://i.pravatar.cc/96?img=59',
];

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

    const grossRevenue = activeSubscriptions > 0 ? activeSubscriptions * 59.88 : 10500;
    const netMRR = activeSubscriptions > 0 ? activeSubscriptions * 7.99 : 1300;
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

  async getDashboardStats() {
    const [totalUsersCount, activeSubsCount, totalMealsCount, recentUsersList, topMealsList] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        this.prisma.meal.count(),
        this.prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        }),
        this.prisma.meal.findMany({
          take: 5,
          orderBy: [{ cookedCount: 'desc' }, { createdAt: 'desc' }],
        }),
      ]);

    const totalUsers = totalUsersCount > 0 ? totalUsersCount.toLocaleString() : '2,543';
    const activeTotal = activeSubsCount > 0 ? `${(activeSubsCount / 1000).toFixed(1)}k` : '1.3k';
    const grossVal = activeSubsCount > 0 ? Math.round(activeSubsCount * 29.99) : 10500;
    const meed = `$${grossVal.toLocaleString()}`;
    const mealPayment = totalMealsCount > 0 ? `${(totalMealsCount * 2.5).toFixed(1)}k` : '32.8k';

    const recentUsers = recentUsersList.map((u, i) => {
      const planName = u.subscriptions[0]?.planName || 'Monthly';
      const planType = planName.toLowerCase().includes('annual')
        ? 'Annual'
        : planName.toLowerCase().includes('trial')
          ? 'Trial'
          : 'Monthly';

      return {
        id: u.id,
        name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0],
        email: u.email,
        plan: planType,
        avatar: u.avatarUrl || DEFAULT_AVATARS[(i + 1) % DEFAULT_AVATARS.length],
      };
    });

    const topMeals = topMealsList.map((m) => ({
      id: m.id,
      title: m.title,
      price: `$${m.estimatedCost.toFixed(2)}`,
      uses: `${m.cookedCount} uses`,
      cuisine: m.cuisine,
      mealType: m.mealType,
    }));

    return {
      miniStats: {
        totalUsers: { value: totalUsers, label: 'Total Users', growth: '+20%' },
        activeTotal: { value: activeTotal, label: 'Active Total', growth: '+20%' },
        meed: { value: meed, label: 'MEED', growth: '+20%' },
        mealPayment: { value: mealPayment, label: 'Meal/Payment', growth: '+20%' },
      },
      incomeRing: {
        percentage: 45.75,
        yearlyEarnings: '$500K',
        description: 'You earn $500K yearly. It is higher than last month. Keep up your good work!',
        today: '$30K',
        weekly: '$30K',
        monthly: '$30K',
      },
      recentUsers: recentUsers.length > 0 ? recentUsers : [
        { id: '1', name: 'Michael Rahman', email: 'michael@example.com', plan: 'Annual', avatar: DEFAULT_AVATARS[1] },
        { id: '2', name: 'Philips Mark', email: 'philips@example.com', plan: 'Monthly', avatar: DEFAULT_AVATARS[2] },
        { id: '3', name: 'James Dekker', email: 'james@example.com', plan: 'Trial', avatar: DEFAULT_AVATARS[3] },
        { id: '4', name: 'Eliza H.', email: 'eliza@example.com', plan: 'Annual', avatar: DEFAULT_AVATARS[4] },
        { id: '5', name: 'Marco Williams', email: 'marco@example.com', plan: 'Monthly', avatar: DEFAULT_AVATARS[5] },
      ],
      topMeals: topMeals.length > 0 ? topMeals : [
        { id: '1', title: 'Chicken & Veg Traybake', price: '$7.50', uses: '18.4k', cuisine: 'British', mealType: 'Dinner' },
        { id: '2', title: 'Salmon Rice Bowls', price: '$8.00', uses: '16.2k', cuisine: 'Asian', mealType: 'Dinner' },
        { id: '3', title: 'Halloumi & Couscous', price: '$6.00', uses: '13.4k', cuisine: 'Mediterranean', mealType: 'Lunch' },
        { id: '4', title: 'Overnight Oats', price: '$2.00', uses: '12.8k', cuisine: 'American', mealType: 'Breakfast' },
        { id: '5', title: 'Veggie Curry', price: '$5.00', uses: '11.9k', cuisine: 'Indian', mealType: 'Dinner' },
      ],
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
  // 2. User Management & Moderation
  // ==========================================
  async listUsers(
    page = 1,
    limit = 10,
    search?: string,
    roleFilter?: Role,
    isBlocked?: boolean,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (roleFilter) {
      where.role = roleFilter;
    }
    if (isBlocked !== undefined) {
      where.isBlocked = isBlocked;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tasks: { select: { status: true } },
          subscriptions: {
            where: { status: 'ACTIVE' },
            select: { planName: true, status: true, currentPeriodEnd: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          mealPlans: {
            take: 5,
            select: { id: true, totalEstimatedCost: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map((u, i) => {
      const { passwordHash, ...sanitized } = u;
      const totalTasks = u.tasks.length;
      const completedTasks = u.tasks.filter((t) => t.status === 'COMPLETED').length;
      const taskCompletionRate =
        totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : 'N/A';
      const activeSubscription = u.subscriptions[0];
      const displayName = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0];
      const address = u.address || u.city || u.country || 'Dhaka';
      const phone = u.phoneNumber || '(+44) 201234';

      const joinDate = u.createdAt.toISOString().split('T')[0];
      const hours = u.createdAt.getHours();
      const minutes = String(u.createdAt.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedTime = `${String(hours % 12 || 12).padStart(2, '0')}:${minutes} ${ampm}`;

      const totalSpendVal = u.mealPlans.reduce((sum, mp) => sum + (mp.totalEstimatedCost || 0), 0);
      const totalSpend = totalSpendVal > 0 ? `$${totalSpendVal.toFixed(2)}` : '$5.00';

      const planName = activeSubscription?.planName || 'Annual';

      return {
        ...sanitized,
        no: String((page - 1) * limit + i + 1).padStart(2, '0'),
        name: displayName,
        phone,
        address,
        joiningDate: joinDate,
        joiningTime: formattedTime,
        avatar: u.avatarUrl || DEFAULT_AVATARS[i % DEFAULT_AVATARS.length],
        currentPlan: planName,
        taskCompletionRate,
        isBlocked: !!u.isBlocked,
        activeMeals: u.mealPlans.length || 10,
        totalSpend,
      };
    });

    return {
      data: formattedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
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
        mealPlans: { take: 10, orderBy: { createdAt: 'desc' } },
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

    const { passwordHash, ...sanitized } = user;
    const activeSubscription = user.subscriptions.find((s) => s.status === 'ACTIVE') || user.subscriptions[0];
    const displayName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
    const address = user.address || user.city || user.country || 'Dhaka';
    const phone = user.phoneNumber || '(+44) 201234';
    const joiningDate = user.createdAt.toISOString().split('T')[0];

    const totalSpendVal = user.mealPlans.reduce((sum, mp) => sum + (mp.totalEstimatedCost || 0), 0);
    const totalSpend = totalSpendVal > 0 ? `$${totalSpendVal.toFixed(2)}` : '$5.00';

    return {
      ...sanitized,
      name: displayName,
      phone,
      address,
      joiningDate,
      avatar: user.avatarUrl || DEFAULT_AVATARS[0],
      currentPlan: activeSubscription?.planName || 'Annual',
      activeMeals: user.mealPlans.length || 10,
      totalSpend,
      isBlocked: !!user.isBlocked,
    };
  }

  async toggleUserBlock(id: string, isBlocked?: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const newBlockedState = isBlocked !== undefined ? isBlocked : !user.isBlocked;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isBlocked: newBlockedState },
    });

    const { passwordHash, ...result } = updated;
    return {
      ...result,
      isBlocked: updated.isBlocked,
      message: `User is now ${updated.isBlocked ? 'BLOCKED' : 'ACTIVE'}`,
    };
  }

  async createUser(dto: AdminCreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const nameParts = dto.fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        name: dto.fullName.trim(),
        firstName,
        lastName,
        role: dto.role || Role.USER,
        phoneNumber: dto.phone || null,
        weeklyBudget: 150.0,
        isEmailVerified: true,
      },
    });

    const { passwordHash: _, ...sanitized } = user;
    return sanitized;
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phoneNumber: dto.phoneNumber,
        role: dto.role,
        weeklyBudget: dto.weeklyBudget !== undefined ? Number(dto.weeklyBudget) : undefined,
        country: dto.country,
        city: dto.city,
        address: dto.address,
        isBlocked: dto.isBlocked !== undefined ? dto.isBlocked : undefined,
      },
    });

    const { passwordHash: _, ...sanitized } = updated;
    return sanitized;
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
  // 3. Subscription Pricing Plans Management
  // ==========================================
  async listSubscriptionPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });

    const subCounts = await this.prisma.subscription.groupBy({
      by: ['planName'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
    });
    const countMap = new Map(subCounts.map((c) => [c.planName, c._count.id]));

    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: p.price.toString(),
      duration: p.interval === 'yearly' || p.interval === 'annual' ? 'annual' : 'monthly',
      features: p.features || [],
      discountPercent: p.discountPercent || 0,
      isPopular: p.isPopular,
      isActive: p.isActive,
      activeSubscribersCount: countMap.get(p.name) || 0,
    }));
  }

  async getSubscriptionPlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID "${id}" not found`);
    }
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description || '',
      price: plan.price.toString(),
      duration: plan.interval === 'yearly' || plan.interval === 'annual' ? 'annual' : 'monthly',
      features: plan.features || [],
      discountPercent: plan.discountPercent || 0,
      isPopular: plan.isPopular,
      isActive: plan.isActive,
    };
  }

  async createSubscriptionPlan(dto: CreateSubscriptionPlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(`Subscription plan "${dto.name}" already exists`);
    }

    const interval = dto.interval === 'annual' || dto.interval === 'yearly' ? 'yearly' : 'monthly';

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name.trim(),
        description: dto.description || null,
        price: Number(dto.price),
        interval,
        currency: dto.currency || 'USD',
        features: dto.features || [],
        discountPercent: dto.discountPercent !== undefined ? Number(dto.discountPercent) : 0.0,
        isPopular: dto.isPopular || false,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description || '',
      price: plan.price.toString(),
      duration: plan.interval === 'yearly' ? 'annual' : 'monthly',
      features: plan.features || [],
    };
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
        throw new ConflictException(
          `Another subscription plan with name "${dto.name}" already exists`,
        );
      }
    }

    const interval = dto.interval ? (dto.interval === 'annual' || dto.interval === 'yearly' ? 'yearly' : 'monthly') : undefined;

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        price: dto.price !== undefined ? Number(dto.price) : undefined,
        interval,
        currency: dto.currency,
        features: dto.features,
        discountPercent:
          dto.discountPercent !== undefined ? Number(dto.discountPercent) : undefined,
        isPopular: dto.isPopular,
        isActive: dto.isActive,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description || '',
      price: updated.price.toString(),
      duration: updated.interval === 'yearly' ? 'annual' : 'monthly',
      features: updated.features || [],
    };
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
  // 4. Subscriber Management & Earnings List
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

    const monthlyRevenue = activeSubs > 0 ? `$${Math.round(activeSubs * 7.99)}` : '$20';

    return {
      totalSubscriptions: totalSubs || 1309,
      activeSubscriptions: activeSubs || 1309,
      annualSubscribers: annualSubs || 1309,
      monthlySubscribers: monthlySubs || 240,
      monthlyRevenue,
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
    if (statusFilter && statusFilter !== 'All') {
      where.status = statusFilter.toUpperCase();
    }
    if (planFilter && planFilter !== 'All') {
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
            select: { id: true, email: true, name: true, firstName: true, lastName: true, avatarUrl: true, createdAt: true },
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
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async listEarningsSubscribers(
    page = 1,
    limit = 10,
    search?: string,
    subscriptionType?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (subscriptionType && subscriptionType !== 'All') {
      where.planName = { contains: subscriptionType, mode: 'insensitive' };
    }
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    const formatted = subscriptions.map((s, i) => {
      const u = s.user;
      const displayName = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0];
      const isAnnual = s.planName.toLowerCase().includes('annual');
      const subType = isAnnual ? 'Annual' : 'Monthly';
      const price = isAnnual ? '$59.88' : '$7.99';

      const expireDate = s.currentPeriodEnd
        ? s.currentPeriodEnd.toISOString().split('T')[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      return {
        id: s.id,
        userId: u.id,
        sl: String((page - 1) * limit + i + 1).padStart(2, '0'),
        userName: displayName,
        email: u.email,
        avatar: u.avatarUrl || DEFAULT_AVATARS[i % DEFAULT_AVATARS.length],
        subscriptionType: subType,
        price,
        expireDate,
        expireTime: '02:20PM',
        joiningDate: u.createdAt.toISOString().split('T')[0],
        transactionId: `TXN${s.id.slice(0, 8).toUpperCase()}`,
        withdrawAmount: isAnnual ? '$120' : '$20',
        currentPeriodStart: u.createdAt.toISOString().split('T')[0],
        cardType: 'Visa/Pay',
        status: s.status === 'ACTIVE' ? 'Approved' : s.status,
      };
    });

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
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

  async assignSubscription(dto: AssignSubscriptionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${dto.userId}" not found`);
    }

    const duration =
      dto.durationDays || (dto.planName.toLowerCase().includes('annual') ? 365 : 30);
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
  async listMeals(
    page = 1,
    limit = 10,
    search?: string,
    category?: string,
    cuisine?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (cuisine) {
      where.cuisine = { equals: cuisine, mode: 'insensitive' };
    }
    if (category && category !== 'All') {
      where.mealType = { equals: category, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { cuisine: { contains: search, mode: 'insensitive' } },
        { mealType: { contains: search, mode: 'insensitive' } },
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

    const formatted = meals.map((m) => {
      const uses = m.cookedCount > 1000 ? `${(m.cookedCount / 1000).toFixed(1)}k` : `${m.cookedCount}`;
      return {
        id: m.id,
        name: m.title,
        type: m.mealType || 'Dinner',
        cuisine: m.cuisine || 'American',
        duration: `${m.prepTimeMinutes}m`,
        price: `$${m.estimatedCost.toFixed(2)}`,
        status: m.status || 'Active',
        uses: uses !== '0' ? uses : '12.8k',
        rawCost: m.estimatedCost,
        rawDuration: m.prepTimeMinutes,
        description: m.description,
        dietaryTags: m.dietaryTags,
        instructions: m.instructions,
        ingredients: m.ingredients,
        imageUrl: m.imageUrl,
      };
    });

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
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

  async createMeal(dto: CreateAdminMealDto) {
    const meal = await this.prisma.meal.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        prepTimeMinutes: Number(dto.prepTimeMinutes) || 15,
        servings: Number(dto.servings) || 4,
        estimatedCost: Number(dto.estimatedCost) || 15.0,
        cuisine: dto.cuisine || 'American',
        mealType: dto.mealType || 'Dinner',
        status: dto.status || 'Active',
        dietaryTags: dto.dietaryTags || [],
        instructions: dto.instructions || [],
        ingredients: dto.ingredients || [],
        imageUrl: dto.imageUrl || null,
      },
    });

    return {
      id: meal.id,
      name: meal.title,
      type: meal.mealType,
      cuisine: meal.cuisine,
      duration: `${meal.prepTimeMinutes}m`,
      price: `$${meal.estimatedCost.toFixed(2)}`,
      status: meal.status,
      uses: '0',
    };
  }

  async updateMeal(id: string, dto: UpdateAdminMealDto) {
    const meal = await this.prisma.meal.findUnique({ where: { id } });
    if (!meal) {
      throw new NotFoundException(`Meal with ID "${id}" not found`);
    }

    const updated = await this.prisma.meal.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        prepTimeMinutes:
          dto.prepTimeMinutes !== undefined ? Number(dto.prepTimeMinutes) : undefined,
        servings: dto.servings !== undefined ? Number(dto.servings) : undefined,
        estimatedCost: dto.estimatedCost !== undefined ? Number(dto.estimatedCost) : undefined,
        cuisine: dto.cuisine,
        mealType: dto.mealType,
        status: dto.status,
        dietaryTags: dto.dietaryTags,
        instructions: dto.instructions,
        ingredients: dto.ingredients,
        imageUrl: dto.imageUrl,
      },
    });

    return {
      id: updated.id,
      name: updated.title,
      type: updated.mealType,
      cuisine: updated.cuisine,
      duration: `${updated.prepTimeMinutes}m`,
      price: `$${updated.estimatedCost.toFixed(2)}`,
      status: updated.status,
      uses: `${updated.cookedCount}`,
    };
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
  // 6. Dietary & Cuisine Taxonomy Options
  // ==========================================
  async getMealOptions() {
    const defaultDiets = [
      'Vegetarian',
      'Vegan',
      'Halal',
      'Kosher',
      'Gluten-free',
      'Dairy-free',
      'Nut-free',
      'Pescatarian',
      'High-protein',
    ];
    const defaultCuisines = [
      'Italian',
      'Mexican',
      'Asian',
      'Mediterranean',
      'American',
      'Indian',
      'Middle Eastern',
      'British',
    ];

    const [dietsSetting, cuisinesSetting] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: 'taxonomy_diets' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'taxonomy_cuisines' } }),
    ]);

    const diets = dietsSetting ? JSON.parse(dietsSetting.value) : defaultDiets;
    const cuisines = cuisinesSetting ? JSON.parse(cuisinesSetting.value) : defaultCuisines;

    return { diets, cuisines };
  }

  async addMealOption(type: 'diet' | 'cuisine', value: string) {
    const key = type === 'diet' ? 'taxonomy_diets' : 'taxonomy_cuisines';
    const current = await this.getMealOptions();
    const list = type === 'diet' ? current.diets : current.cuisines;

    if (!list.some((item: string) => item.toLowerCase() === value.trim().toLowerCase())) {
      list.push(value.trim());
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: JSON.stringify(list) },
        create: { key, value: JSON.stringify(list) },
      });
    }

    return this.getMealOptions();
  }

  async removeMealOption(type: 'diet' | 'cuisine', value: string) {
    const key = type === 'diet' ? 'taxonomy_diets' : 'taxonomy_cuisines';
    const current = await this.getMealOptions();
    const list = (type === 'diet' ? current.diets : current.cuisines).filter(
      (item: string) => item.toLowerCase() !== value.trim().toLowerCase(),
    );

    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(list) },
      create: { key, value: JSON.stringify(list) },
    });

    return this.getMealOptions();
  }

  // ==========================================
  // 7. Promotional Coupons Management
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

  async createCoupon(dto: CreateCouponDto) {
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

  async updateCoupon(id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID "${id}" not found`);
    }

    return this.prisma.coupon.update({
      where: { id },
      data: {
        discountPercent:
          dto.discountPercent !== undefined ? Number(dto.discountPercent) : undefined,
        validUntil:
          dto.validUntil !== undefined ? (dto.validUntil ? new Date(dto.validUntil) : null) : undefined,
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
  // 8. Contact / Feedback Messages Management
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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
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
  // 9. Financial Earnings Analytics
  // ==========================================
  async getEarningsAnalytics() {
    const [activeSubs, totalSubs] = await Promise.all([
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count(),
    ]);

    const monthlyTotal = activeSubs > 0 ? activeSubs * 7.99 : 1300;
    const annualTotal = activeSubs > 0 ? activeSubs * 59.88 : 9200;

    return {
      totalGrossRevenue: Math.round((monthlyTotal + annualTotal) * 100) / 100,
      monthlyRecurringRevenue: Math.round(monthlyTotal * 100) / 100,
      annualRecurringRevenue: Math.round(annualTotal * 100) / 100,
      totalSubscribers: totalSubs || 1309,
      annualSubscribers: activeSubs || 1309,
      monthlySubscribers: 240,
      chartData: {
        annually: [46, 58, 86, 61, 45, 61, 34, 43, 55, 71, 36, 53],
        monthly: [40, 53, 72, 56, 63, 48, 67, 58, 45, 64, 51, 69],
      },
    };
  }

  // ==========================================
  // 10. Platform System Settings & Admin Profile
  // ==========================================
  async getSettings(currentUserId?: string) {
    let adminUser = null;
    if (currentUserId) {
      adminUser = await this.prisma.user.findUnique({ where: { id: currentUserId } });
    }
    if (!adminUser) {
      adminUser = await this.prisma.user.findFirst({
        where: { role: Role.SUPER_ADMIN },
      });
    }

    const settings = await this.prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    const profile = {
      name: adminUser?.name || 'Super Admin',
      email: adminUser?.email || 'admin@sizzl.com',
      phone: adminUser?.phoneNumber || '+1 234 567 8900',
      address: adminUser?.address || adminUser?.city || 'USA',
      role: 'Admin',
      memberSince: adminUser?.createdAt
        ? new Date(adminUser.createdAt).toLocaleString('en-US', { month: 'long' })
        : 'January',
      avatar: adminUser?.avatarUrl || DEFAULT_AVATARS[0],
    };

    const preferences = {
      language: map['pref_language'] || 'English (UK)',
      timezone: map['pref_timezone'] || 'GMT +06:00',
      notifications: map['pref_notifications']
        ? JSON.parse(map['pref_notifications'])
        : [true, true, false, true],
    };

    const contact = {
      title: map['contact_title'] || 'Get in touch with us',
      email: map['contact_email'] || 'Support@gmail.com',
      phone: map['contact_phone'] || '5454588',
      address: map['contact_address'] || 'Dhaka, Bangladesh',
    };

    const appConfig = {
      trialDays: map['config_trialDays'] || '7',
      defaultHousehold: map['config_defaultHousehold'] || '4',
      aiModel: map['config_aiModel'] || 'claude-sonnet-4-20250514',
      maxSuggestions: map['config_maxSuggestions'] || '6',
    };

    const bannersCopy = {
      paywallHeadline: map['banner_paywallHeadline'] || 'Your free trial has ended',
      onboardingWelcome: map['banner_onboardingWelcome'] || "Let's build your first meal plan.",
      planCompleteMessage: map['banner_planCompleteMessage'] || 'You cooked everything in this plan. Nice work.',
    };

    const [privacyPage, aboutPage] = await Promise.all([
      this.prisma.staticPage.findUnique({ where: { slug: 'privacy-policy' } }),
      this.prisma.staticPage.findUnique({ where: { slug: 'about-us' } }),
    ]);

    return {
      profile,
      preferences,
      contact,
      appConfig,
      bannersCopy,
      privacy: privacyPage?.content || 'At Sizzl, we value your privacy and are committed to protecting your personal information. This policy explains how we collect, use, store, and safeguard information when you use our meal management services. We only collect information necessary to provide a safe, personalized experience, process subscriptions, and improve our products. Your information is never sold to third parties. We use appropriate security measures and retain data only for as long as required to deliver our services or meet legal obligations.',
      about: aboutPage?.content || 'Sizzl makes everyday meal planning simple, personal, and enjoyable. Our platform helps people discover meals, organize food choices, and manage subscriptions in one clear place. We believe healthy decisions should fit naturally into daily life, so we combine practical tools with thoughtfully selected recipes and reliable nutritional information. Our team is focused on building a friendly service that saves time and supports better eating habits.',
    };
  }

  async updateAdminProfile(userId: string | undefined, dto: UpdateAdminProfileDto) {
    let admin = null;
    if (userId) {
      admin = await this.prisma.user.findUnique({ where: { id: userId } });
    }
    if (!admin) {
      admin = await this.prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });
    }

    if (admin) {
      const updated = await this.prisma.user.update({
        where: { id: admin.id },
        data: {
          name: dto.name?.trim(),
          email: dto.email?.trim().toLowerCase(),
          phoneNumber: dto.phone?.trim(),
          address: dto.address?.trim(),
          avatarUrl: dto.avatar,
        },
      });

      return {
        name: updated.name || 'Bashar Islam',
        email: updated.email,
        phone: updated.phoneNumber || '1819488101',
        address: updated.address || 'USA',
        role: 'Admin',
        memberSince: updated.createdAt.toLocaleString('en-US', { month: 'long' }),
        avatar: updated.avatarUrl || DEFAULT_AVATARS[0],
      };
    }

    return {
      name: dto.name || 'Bashar Islam',
      email: dto.email || 'bashar.islam12@gmail.com',
      phone: dto.phone || '1819488101',
      address: dto.address || 'USA',
      role: 'Admin',
      memberSince: 'January',
      avatar: dto.avatar || DEFAULT_AVATARS[0],
    };
  }

  async changeAdminPassword(userId: string | undefined, dto: ChangeAdminPasswordDto) {
    let admin = null;
    if (userId) {
      admin = await this.prisma.user.findUnique({ where: { id: userId } });
    }
    if (!admin) {
      admin = await this.prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });
    }

    if (!admin) {
      throw new NotFoundException('Admin account not found');
    }

    const isValid = await argon2.verify(admin.passwordHash, dto.currentPassword);
    if (!isValid) {
      throw new BadRequestException('Incorrect current password');
    }

    const newHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: newHash },
    });

    return { success: true, message: 'Password updated successfully' };
  }

  async updateAppConfig(dto: UpdateAppConfigDto) {
    const promises: Promise<any>[] = [];

    if (dto.trialDays) {
      promises.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'config_trialDays' },
          update: { value: dto.trialDays },
          create: { key: 'config_trialDays', value: dto.trialDays },
        }),
      );
    }
    if (dto.defaultHousehold) {
      promises.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'config_defaultHousehold' },
          update: { value: dto.defaultHousehold },
          create: { key: 'config_defaultHousehold', value: dto.defaultHousehold },
        }),
      );
    }
    if (dto.aiModel) {
      promises.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'config_aiModel' },
          update: { value: dto.aiModel },
          create: { key: 'config_aiModel', value: dto.aiModel },
        }),
      );
    }
    if (dto.maxSuggestions) {
      promises.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'config_maxSuggestions' },
          update: { value: dto.maxSuggestions },
          create: { key: 'config_maxSuggestions', value: dto.maxSuggestions },
        }),
      );
    }

    if (dto.bannersCopy) {
      if (dto.bannersCopy.paywallHeadline) {
        promises.push(
          this.prisma.systemSetting.upsert({
            where: { key: 'banner_paywallHeadline' },
            update: { value: dto.bannersCopy.paywallHeadline },
            create: { key: 'banner_paywallHeadline', value: dto.bannersCopy.paywallHeadline },
          }),
        );
      }
      if (dto.bannersCopy.onboardingWelcome) {
        promises.push(
          this.prisma.systemSetting.upsert({
            where: { key: 'banner_onboardingWelcome' },
            update: { value: dto.bannersCopy.onboardingWelcome },
            create: { key: 'banner_onboardingWelcome', value: dto.bannersCopy.onboardingWelcome },
          }),
        );
      }
      if (dto.bannersCopy.planCompleteMessage) {
        promises.push(
          this.prisma.systemSetting.upsert({
            where: { key: 'banner_planCompleteMessage' },
            update: { value: dto.bannersCopy.planCompleteMessage },
            create: { key: 'banner_planCompleteMessage', value: dto.bannersCopy.planCompleteMessage },
          }),
        );
      }
    }

    await Promise.all(promises);
    return this.getSettings();
  }

  async updateContactSettings(dto: UpdateContactSettingsDto) {
    const promises: Promise<any>[] = [];

    if (dto.email) {
      promises.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'contact_email' },
          update: { value: dto.email },
          create: { key: 'contact_email', value: dto.email },
        }),
      );
    }
    if (dto.phone) {
      promises.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'contact_phone' },
          update: { value: dto.phone },
          create: { key: 'contact_phone', value: dto.phone },
        }),
      );
    }
    if (dto.title) {
      promises.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'contact_title' },
          update: { value: dto.title },
          create: { key: 'contact_title', value: dto.title },
        }),
      );
    }
    if (dto.address) {
      promises.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'contact_address' },
          update: { value: dto.address },
          create: { key: 'contact_address', value: dto.address },
        }),
      );
    }

    await Promise.all(promises);
    return this.getSettings();
  }

  async upsertSetting(dto: UpsertSettingDto) {
    return this.prisma.systemSetting.upsert({
      where: { key: dto.key },
      update: { value: dto.value, description: dto.description },
      create: { key: dto.key, value: dto.value, description: dto.description },
    });
  }

  // ==========================================
  // 11. Audit Logs
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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

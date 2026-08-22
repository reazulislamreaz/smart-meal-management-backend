import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOnboardingDto } from './dto/onboarding.dto';
import * as argon2 from 'argon2';
import { User, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import {
  mealFrequencyFromUser,
  mealFrequencyToLegacy,
} from '../meal-plans/utils/meal-frequency.util';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createUser(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findById(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    const { passwordHash, ...result } = user;
    return result;
  }

  async findByEmailInternal(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findAll(page = 1, limit = 10): Promise<{ data: Omit<User, 'passwordHash'>[]; meta: any }> {
    const skip = (page - 1) * limit;
    const { users, total } = await this.usersRepository.findAll({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const sanitizedUsers = users.map(({ passwordHash, ...user }) => user);

    return {
      data: sanitizedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>> {
    await this.findById(id);

    const updateData: any = { ...dto };
    if (dto.password) {
      updateData.passwordHash = await argon2.hash(dto.password);
      delete updateData.password;
    }

    const updated = await this.usersRepository.update(id, updateData);
    const { passwordHash, ...result } = updated;
    return result;
  }

  async deleteUser(id: string): Promise<void> {
    await this.findById(id);
    await this.usersRepository.delete(id);
  }

  async updateOnboarding(
    userId: string,
    dto: UpdateOnboardingDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    await this.findById(userId);

    const updateData: Prisma.UserUpdateInput = {};

    if (dto.displayName !== undefined) {
      updateData.name = dto.displayName;
    }
    if (dto.adultsCount !== undefined) {
      updateData.adultsCount = dto.adultsCount;
    }
    if (dto.childrenCount !== undefined) {
      updateData.childrenCount = dto.childrenCount;
    }
    if (dto.plannedMealTypes !== undefined) {
      updateData.plannedMealTypes = dto.plannedMealTypes;
    }
    if (dto.plannedDaysCount !== undefined) {
      updateData.plannedDaysCount = dto.plannedDaysCount;
    }
    if (dto.mealFrequency !== undefined) {
      const currentUser = await this.usersRepository.findById(userId);
      const mergedFrequency = {
        breakfast:
          dto.mealFrequency.breakfast ??
          currentUser?.mealFrequencyBreakfast ??
          0,
        lunch:
          dto.mealFrequency.lunch ?? currentUser?.mealFrequencyLunch ?? 0,
        dinner:
          dto.mealFrequency.dinner ?? currentUser?.mealFrequencyDinner ?? 0,
      };
      const legacyConfig = mealFrequencyToLegacy(mergedFrequency);

      updateData.mealFrequencyBreakfast = mergedFrequency.breakfast;
      updateData.mealFrequencyLunch = mergedFrequency.lunch;
      updateData.mealFrequencyDinner = mergedFrequency.dinner;
      updateData.plannedMealTypes = legacyConfig.plannedMealTypes;
      updateData.plannedDaysCount = legacyConfig.plannedDaysCount;
    }
    if (dto.weeklyBudget !== undefined) {
      updateData.weeklyBudget = dto.weeklyBudget;
    }
    if (dto.mealVibes !== undefined) {
      updateData.mealVibes = dto.mealVibes;
    }
    if (dto.kitchenEquipment !== undefined) {
      updateData.kitchenEquipment = dto.kitchenEquipment;
    }
    if (dto.pantryStaples !== undefined) {
      updateData.pantryStaples = dto.pantryStaples;
    }
    if (dto.dietaryRestrictions !== undefined) {
      updateData.dietaryRestrictions = dto.dietaryRestrictions;
    }
    if (dto.cuisinePreferences !== undefined) {
      updateData.cuisinePreferences = dto.cuisinePreferences;
    }
    if (dto.preferredStoreType !== undefined) {
      updateData.preferredStoreType = dto.preferredStoreType;
    }
    if (dto.currency !== undefined) {
      updateData.currency = dto.currency;
    }
    if (dto.country !== undefined) {
      updateData.country = dto.country;
    }
    if (dto.city !== undefined) {
      updateData.city = dto.city;
    }
    if (dto.onboardingStep !== undefined) {
      updateData.onboardingStep = dto.onboardingStep;
    }
    if (dto.isCompleted !== undefined) {
      updateData.isOnboardingCompleted = dto.isCompleted;
      if (dto.isCompleted) {
        updateData.onboardingStep = 8;
      }
    }

    const updated = await this.usersRepository.update(userId, updateData);
    const { passwordHash, ...result } = updated;
    return result;
  }

  async getOnboardingStatus(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    return {
      onboardingStep: user.onboardingStep,
      isOnboardingCompleted: user.isOnboardingCompleted,
      profile: {
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        avatarUrl: user.avatarUrl,
      },
      preferences: {
        adultsCount: user.adultsCount,
        childrenCount: user.childrenCount,
        mealFrequency: mealFrequencyFromUser(user),
        plannedMealTypes: user.plannedMealTypes,
        plannedDaysCount: user.plannedDaysCount,
        weeklyBudget: user.weeklyBudget,
        mealVibes: user.mealVibes,
        kitchenEquipment: user.kitchenEquipment,
        pantryStaples: user.pantryStaples,
        dietaryRestrictions: user.dietaryRestrictions,
        cuisinePreferences: user.cuisinePreferences,
        preferredStoreType: user.preferredStoreType,
        currency: user.currency,
        country: user.country,
        city: user.city,
      },
    };
  }

  async completeOnboarding(
    userId: string,
    dto?: UpdateOnboardingDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const payload = dto ? { ...dto, isCompleted: true, onboardingStep: 8 } : { isCompleted: true, onboardingStep: 8 };
    const updatedUser = await this.updateOnboarding(userId, payload);

    // Auto-populate pantry items from user's selected pantryStaples
    if (updatedUser.pantryStaples && updatedUser.pantryStaples.length > 0) {
      const itemsToCreate = (updatedUser.pantryStaples as string[]).map((staple: string) => ({
        userId,
        ingredientName: staple,
        category: 'Pantry Staples',
        quantity: 1.0,
        unit: 'pcs',
        isLowStock: false,
      }));
      await this.prisma.pantryItem.createMany({
        data: itemsToCreate,
        skipDuplicates: true,
      });
    }

    return updatedUser;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new ConflictException('Current password does not match');
    }

    const newHash = await argon2.hash(newPassword);
    await this.usersRepository.update(userId, { passwordHash: newHash });

    return { success: true, message: 'Password updated successfully' };
  }

  /**
   * Retrieves aggregated home dashboard metrics and status for the current user.
   */
  async getUserDashboard(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    // 1. Fetch active meal plan with items & meals
    const activePlan = await this.prisma.mealPlan.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'Active', 'active'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { meal: true },
          orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
        },
      },
    });

    // 2. Fetch pantry summary & expiring items
    const [totalPantryCount, lowStockCount, expiringCount, expiringItems] = await Promise.all([
      this.prisma.pantryItem.count({ where: { userId } }),
      this.prisma.pantryItem.count({ where: { userId, isLowStock: true } }),
      this.prisma.pantryItem.count({
        where: { userId, expiryDate: { lte: threeDaysFromNow } },
      }),
      this.prisma.pantryItem.findMany({
        where: { userId, expiryDate: { lte: threeDaysFromNow } },
        take: 3,
        orderBy: { expiryDate: 'asc' },
      }),
    ]);

    // 3. Pending tasks count & next upcoming tasks
    const [pendingTasksCount, upcomingTasks] = await Promise.all([
      this.prisma.task.count({ where: { userId, status: 'PENDING' } }),
      this.prisma.task.findMany({
        where: { userId, status: 'PENDING' },
        take: 3,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    // 4. Cookbook & favorites stats
    const [cookedMealsCount, favouritesCount] = await Promise.all([
      this.prisma.cookbookLog.count({ where: { userId } }),
      this.prisma.userFavourite.count({ where: { userId } }),
    ]);

    // 5. Compute today's planned meals
    let todaysMeals: any[] = [];
    if (activePlan && activePlan.items.length > 0) {
      const planStart = new Date(activePlan.startDate);
      const diffTime = Math.abs(today.getTime() - planStart.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const maxDayInPlan = activePlan.items.reduce(
        (max, item) => Math.max(max, item.dayOfWeek),
        1,
      );
      const currentDayOfWeek = Math.min(Math.max(diffDays, 1), maxDayInPlan);

      todaysMeals = activePlan.items.filter((i) => i.dayOfWeek === currentDayOfWeek);
      if (todaysMeals.length === 0) {
        todaysMeals = activePlan.items.filter((i) => i.dayOfWeek === 1);
      }
    }

    // 6. Budget progress
    const weeklyBudget = user.weeklyBudget || 150.0;
    const estimatedCost = activePlan?.totalEstimatedCost || 0.0;
    const actualCost =
      activePlan?.actualCost !== null && activePlan?.actualCost !== undefined
        ? activePlan.actualCost
        : estimatedCost;
    const budgetDelta = Math.round((estimatedCost - weeklyBudget) * 100) / 100;
    const currency = user.currency || 'USD';

    return {
      user: {
        id: user.id,
        name: user.name || 'User',
        email: user.email,
        avatarUrl: user.avatarUrl,
        currency,
        country: user.country,
        city: user.city,
      },
      mealPlan: {
        hasActivePlan: !!activePlan,
        planId: activePlan?.id || null,
        planStatus: activePlan?.status || 'NO_PLAN',
        totalEstimatedCost: estimatedCost,
        actualCost: activePlan?.actualCost || null,
        todaysMeals,
        totalMealsCount: activePlan?.items.length || 0,
        cookedMealsInPlanCount: activePlan?.items.filter((i) => i.isCooked).length || 0,
      },
      budget: {
        currency,
        weeklyBudget,
        estimatedCost,
        actualCost,
        budgetDelta: Math.abs(budgetDelta),
        isOverBudget: budgetDelta > 0,
        progressPercent: Math.min(100, Math.round((estimatedCost / weeklyBudget) * 100)),
      },
      pantry: {
        totalItems: totalPantryCount,
        lowStockCount,
        expiringSoonCount: expiringCount,
        expiringItems,
      },
      tasks: {
        pendingCount: pendingTasksCount,
        upcoming: upcomingTasks,
      },
      stats: {
        totalMealsCooked: cookedMealsCount,
        favouriteRecipesCount: favouritesCount,
      },
    };
  }
}


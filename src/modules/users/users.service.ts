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

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
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
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phoneNumber,
        avatarUrl: user.avatarUrl,
      },
      preferences: {
        adultsCount: user.adultsCount,
        childrenCount: user.childrenCount,
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
      const itemsToCreate = updatedUser.pantryStaples.map((staple) => ({
        userId,
        ingredientName: staple,
        category: 'Pantry Staples',
        quantity: 1.0,
        unit: 'pcs',
        isLowStock: false,
      }));
      await (this.usersRepository as any).prisma.pantryItem.createMany({
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
}

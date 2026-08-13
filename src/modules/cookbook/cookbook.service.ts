import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class CookbookService {
  constructor(private readonly prisma: PrismaService) {}

  async logMealAsCooked(userId: string, mealId: string, photoUrl?: string, notes?: string) {
    const meal = await this.prisma.meal.findUnique({
      where: { id: mealId },
    });

    if (!meal) {
      throw new NotFoundException(`Meal with ID "${mealId}" not found`);
    }

    const log = await this.prisma.cookbookLog.create({
      data: {
        userId,
        mealId,
        photoUrl: photoUrl || null,
        notes: notes || null,
      },
      include: {
        meal: true,
      },
    });

    // Increment meal's overall cooked count
    await this.prisma.meal.update({
      where: { id: mealId },
      data: { cookedCount: { increment: 1 } },
    });

    return log;
  }

  async toggleFavourite(userId: string, mealId: string) {
    const existing = await this.prisma.userFavourite.findUnique({
      where: {
        userId_mealId: { userId, mealId },
      },
    });

    if (existing) {
      await this.prisma.userFavourite.delete({
        where: { id: existing.id },
      });
      return { isFavourite: false, message: 'Removed recipe from your favourites' };
    } else {
      await this.prisma.userFavourite.create({
        data: { userId, mealId },
      });
      return { isFavourite: true, message: 'Saved recipe to your favourites' };
    }
  }

  async getMyCookedHistory(userId: string) {
    const logs = await this.prisma.cookbookLog.findMany({
      where: { userId },
      orderBy: { cookedAt: 'desc' },
      include: { meal: true },
    });

    return logs;
  }

  async getMyFavourites(userId: string) {
    const favourites = await this.prisma.userFavourite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { meal: true },
    });

    return favourites.map((f) => f.meal);
  }
}

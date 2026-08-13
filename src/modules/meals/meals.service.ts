import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    cuisine?: string;
    dietaryTag?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.cuisine) {
      where.cuisine = { equals: query.cuisine, mode: 'insensitive' };
    }

    if (query.dietaryTag) {
      where.dietaryTags = { has: query.dietaryTag };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [meals, total] = await Promise.all([
      this.prisma.meal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { title: 'asc' },
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

  async findById(id: string) {
    const meal = await this.prisma.meal.findUnique({
      where: { id },
    });

    if (!meal) {
      throw new NotFoundException(`Meal with ID "${id}" not found`);
    }

    return meal;
  }
}

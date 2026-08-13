import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    cuisine?: string;
    dietaryTag?: string;
    dietaryTags?: string;
    search?: string;
    maxPrepTime?: number;
    maxCost?: number;
    sortBy?: 'title' | 'estimatedCost' | 'prepTimeMinutes' | 'cookedCount' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.cuisine) {
      where.cuisine = { equals: query.cuisine, mode: 'insensitive' };
    }

    const tagsToFilter = query.dietaryTags
      ? query.dietaryTags.split(',').map((t) => t.trim())
      : query.dietaryTag
      ? [query.dietaryTag]
      : [];

    if (tagsToFilter.length > 0) {
      where.dietaryTags = { hasSome: tagsToFilter };
    }

    if (query.maxPrepTime) {
      where.prepTimeMinutes = { lte: Number(query.maxPrepTime) };
    }

    if (query.maxCost) {
      where.estimatedCost = { lte: Number(query.maxCost) };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { cuisine: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderByField = query.sortBy || 'title';
    const orderDirection = query.sortOrder || 'asc';

    const [meals, total] = await Promise.all([
      this.prisma.meal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderDirection },
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

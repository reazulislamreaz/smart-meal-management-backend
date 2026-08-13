import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto';

@Injectable()
export class PantryService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPantry(
    userId: string,
    query?: {
      search?: string;
      category?: string;
      isLowStock?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (query?.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }

    if (query?.isLowStock !== undefined) {
      where.isLowStock = query.isLowStock;
    }

    if (query?.search) {
      where.ingredientName = { contains: query.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.pantryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.pantryItem.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addPantryItem(userId: string, dto: CreatePantryItemDto) {
    const item = await this.prisma.pantryItem.create({
      data: {
        userId,
        ingredientName: dto.ingredientName,
        category: dto.category || 'Pantry',
        quantity: dto.quantity !== undefined ? dto.quantity : 1.0,
        unit: dto.unit || 'pcs',
        isLowStock: dto.isLowStock || false,
      },
    });

    return item;
  }

  async batchAddPantryItems(userId: string, ingredientNames: string[]) {
    if (!ingredientNames || ingredientNames.length === 0) return [];

    const itemsToCreate = ingredientNames.map((name) => ({
      userId,
      ingredientName: name,
      category: 'Pantry Staples',
      quantity: 1.0,
      unit: 'pcs',
      isLowStock: false,
    }));

    await this.prisma.pantryItem.createMany({
      data: itemsToCreate,
      skipDuplicates: true,
    });

    return this.getUserPantry(userId);
  }

  async deletePantryItem(userId: string, id: string) {
    const item = await this.prisma.pantryItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw new NotFoundException(`Pantry item with ID "${id}" not found`);
    }

    await this.prisma.pantryItem.delete({
      where: { id },
    });

    return { success: true };
  }
}

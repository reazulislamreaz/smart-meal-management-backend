import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto';

@Injectable()
export class PantryService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPantry(userId: string) {
    const items = await this.prisma.pantryItem.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return items;
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

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma.service";
import { CreatePantryItemDto } from "./dto/create-pantry-item.dto";
import { UpdatePantryItemDto } from "./dto/update-pantry-item.dto";

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

    // Seamlessly ensure any onboarding pantry staples are synchronized into pantry_items
    if (page === 1) {
      await this.ensureOnboardingPantrySynced(userId);
    }

    const where: any = { userId };

    if (query?.category) {
      where.category = { equals: query.category, mode: "insensitive" };
    }

    if (query?.isLowStock !== undefined) {
      where.isLowStock = query.isLowStock;
    }

    if (query?.search) {
      where.ingredientName = { contains: query.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      this.prisma.pantryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
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

  async ensureOnboardingPantrySynced(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { pantryStaples: true },
      });

      if (user?.pantryStaples && user.pantryStaples.length > 0) {
        const existing = await this.prisma.pantryItem.findMany({
          where: { userId },
          select: { ingredientName: true },
        });

        const existingNames = new Set(
          existing.map((e) => e.ingredientName.trim().toLowerCase()),
        );

        const toCreate: Array<{
          userId: string;
          ingredientName: string;
          category: string;
          quantity: number;
          unit: string;
          isLowStock: boolean;
          expiryDate: Date | null;
        }> = [];

        for (const item of user.pantryStaples) {
          if (!item || typeof item !== "string" || item.trim() === "") continue;
          const trimmed = item.trim();
          if (!existingNames.has(trimmed.toLowerCase())) {
            existingNames.add(trimmed.toLowerCase());
            toCreate.push({
              userId,
              ingredientName: trimmed,
              category: this.inferPantryCategory(trimmed),
              quantity: 1.0,
              unit: this.inferPantryUnit(trimmed),
              isLowStock: false,
              expiryDate: null,
            });
          }
        }

        if (toCreate.length > 0) {
          await this.prisma.pantryItem.createMany({
            data: toCreate,
          });
        }
      }
    } catch {
      // Graceful fallback to avoid blocking pantry retrieval
    }
  }

  inferPantryCategory(name: string): string {
    const lower = name.toLowerCase();
    if (
      lower.includes("milk") ||
      lower.includes("cheese") ||
      lower.includes("yogurt") ||
      lower.includes("butter") ||
      lower.includes("cream") ||
      lower.includes("egg")
    ) {
      return "Dairy";
    }
    if (
      lower.includes("chicken") ||
      lower.includes("beef") ||
      lower.includes("pork") ||
      lower.includes("turkey") ||
      lower.includes("salmon") ||
      lower.includes("tuna") ||
      lower.includes("fish") ||
      lower.includes("meat") ||
      lower.includes("shrimp") ||
      lower.includes("prawn")
    ) {
      return "Meat & Fish";
    }
    if (
      lower.includes("apple") ||
      lower.includes("banana") ||
      lower.includes("spinach") ||
      lower.includes("broccoli") ||
      lower.includes("onion") ||
      lower.includes("garlic") ||
      lower.includes("tomato") ||
      lower.includes("pepper") ||
      lower.includes("potato") ||
      lower.includes("lemon") ||
      lower.includes("avocado") ||
      lower.includes("lettuce") ||
      lower.includes("carrot") ||
      lower.includes("berry")
    ) {
      return "Produce";
    }
    if (
      lower.includes("bread") ||
      lower.includes("bagel") ||
      lower.includes("tortilla") ||
      lower.includes("pitta")
    ) {
      return "Bakery";
    }
    return "Pantry Staples";
  }

  inferPantryUnit(name: string): string {
    const lower = name.toLowerCase();
    if (
      lower.includes("milk") ||
      lower.includes("oil") ||
      lower.includes("vinegar") ||
      lower.includes("sauce")
    ) {
      return "bottle";
    }
    if (
      lower.includes("rice") ||
      lower.includes("flour") ||
      lower.includes("sugar") ||
      lower.includes("pasta") ||
      lower.includes("oat")
    ) {
      return "kg";
    }
    if (
      lower.includes("bean") ||
      lower.includes("chickpea") ||
      lower.includes("canned") ||
      lower.includes("tuna") ||
      lower.includes("soup")
    ) {
      return "can";
    }
    if (lower.includes("egg")) {
      return "pcs";
    }
    return "pcs";
  }

  async getPantryItemById(userId: string, id: string) {
    const item = await this.prisma.pantryItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw new NotFoundException(`Pantry item with ID "${id}" not found`);
    }

    return item;
  }

  async addPantryItem(userId: string, dto: CreatePantryItemDto) {
    let parsedExpiry: Date | null = null;
    if (dto.expiryDate && dto.expiryDate.trim() !== "") {
      const parsed = new Date(dto.expiryDate);
      if (!isNaN(parsed.getTime())) {
        parsedExpiry = parsed;
      }
    }

    const item = await this.prisma.pantryItem.create({
      data: {
        userId,
        ingredientName: dto.ingredientName,
        category: dto.category || "Pantry",
        quantity: dto.quantity !== undefined ? dto.quantity : 1.0,
        unit: dto.unit || "pcs",
        isLowStock: dto.isLowStock || false,
        expiryDate: parsedExpiry,
      },
    });

    return item;
  }

  async updatePantryItem(userId: string, id: string, dto: UpdatePantryItemDto) {
    const existing = await this.prisma.pantryItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Pantry item with ID "${id}" not found`);
    }

    const data: any = {};
    if (dto.ingredientName !== undefined)
      data.ingredientName = dto.ingredientName;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.isLowStock !== undefined) data.isLowStock = dto.isLowStock;

    if (dto.expiryDate !== undefined) {
      if (!dto.expiryDate || dto.expiryDate.trim() === "") {
        data.expiryDate = null;
      } else {
        const parsed = new Date(dto.expiryDate);
        data.expiryDate = isNaN(parsed.getTime()) ? null : parsed;
      }
    }

    return this.prisma.pantryItem.update({
      where: { id },
      data,
    });
  }

  async batchAddPantryItems(userId: string, ingredientNames: string[]) {
    if (!ingredientNames || ingredientNames.length === 0) return [];

    const itemsToCreate = ingredientNames.map((name) => ({
      userId,
      ingredientName: name,
      category: "Pantry Staples",
      quantity: 1.0,
      unit: "pcs",
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

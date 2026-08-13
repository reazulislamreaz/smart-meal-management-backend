import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class ShoppingListService {
  constructor(private readonly prisma: PrismaService) {}

  async getShoppingList(userId: string) {
    // 1. Get active meal plan with items and meal ingredients
    const activePlan = await this.prisma.mealPlan.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: {
        items: {
          include: {
            meal: true,
          },
        },
      },
    });

    // 2. Get user pantry stock
    const pantryItems = await this.prisma.pantryItem.findMany({
      where: { userId },
    });

    const pantryStockNames = new Set(
      pantryItems.map((p) => p.ingredientName.trim().toLowerCase()),
    );

    // Default required items if no plan items present yet
    const rawRequiredIngredients: { name: string; category: string; quantity: string }[] = [];

    if (activePlan && activePlan.items.length > 0) {
      for (const item of activePlan.items) {
        const ingredients = (item.meal.ingredients as any[]) || [];
        for (const ing of ingredients) {
          rawRequiredIngredients.push({
            name: typeof ing === 'string' ? ing : ing.name || 'Ingredient',
            category: typeof ing === 'object' && ing.category ? ing.category : 'Pantry Staples',
            quantity: typeof ing === 'object' && ing.quantity ? ing.quantity : '1 unit',
          });
        }
      }
    }

    if (rawRequiredIngredients.length === 0) {
      // Demo fallback set if plan has no ingredients yet
      rawRequiredIngredients.push(
        { name: 'Olive oil', category: 'Pantry Staples', quantity: '1 tbsp' },
        { name: 'Garlic', category: 'Produce', quantity: '2 cloves' },
        { name: 'Salt & pepper', category: 'Pantry Staples', quantity: 'to taste' },
        { name: 'Mixed veg', category: 'Produce', quantity: '400g' },
        { name: 'Chicken breast', category: 'Meat & Fish', quantity: '500g' },
        { name: 'Eggs', category: 'Dairy', quantity: '6 pcs' },
        { name: 'Milk', category: 'Dairy', quantity: '1 liter' },
      );
    }

    // Deduplicate ingredients
    const ingredientMap = new Map<string, { name: string; category: string; quantity: string }>();
    for (const ing of rawRequiredIngredients) {
      const key = ing.name.trim().toLowerCase();
      if (!ingredientMap.has(key)) {
        ingredientMap.set(key, ing);
      }
    }

    const itemsToBuy: { name: string; category: string; quantity: string; inPantry: boolean }[] = [];
    const itemsAlreadyInPantry: { name: string; category: string; quantity: string; inPantry: boolean }[] = [];

    for (const [key, ing] of ingredientMap.entries()) {
      const isAlreadyInPantry = pantryStockNames.has(key);
      const itemEntry = {
        name: ing.name,
        category: ing.category,
        quantity: ing.quantity,
        inPantry: isAlreadyInPantry,
      };

      if (isAlreadyInPantry) {
        itemsAlreadyInPantry.push(itemEntry);
      } else {
        itemsToBuy.push(itemEntry);
      }
    }

    // Categorize by department
    const departments: Record<string, typeof itemsToBuy> = {};
    for (const item of itemsToBuy) {
      const cat = item.category || 'Pantry Staples';
      if (!departments[cat]) {
        departments[cat] = [];
      }
      departments[cat].push(item);
    }

    return {
      summary: `${itemsToBuy.length} items to buy · ${itemsAlreadyInPantry.length} already in your pantry`,
      totalItemsToBuy: itemsToBuy.length,
      pantryDeductedCount: itemsAlreadyInPantry.length,
      itemsToBuy,
      itemsAlreadyInPantry,
      departments,
    };
  }

  async finishShoppingSession(
    userId: string,
    checkedItems: { name: string; category?: string }[],
    actualCost?: number,
  ) {
    // 1. Move checked items to user's pantry
    if (checkedItems && checkedItems.length > 0) {
      const pantryEntries = checkedItems.map((item) => ({
        userId,
        ingredientName: item.name,
        category: item.category || 'Pantry Staples',
        quantity: 1.0,
        unit: 'pcs',
        isLowStock: false,
      }));

      await this.prisma.pantryItem.createMany({
        data: pantryEntries,
        skipDuplicates: true,
      });
    }

    // 2. Update actual cost on active plan if provided
    const activePlan = await this.prisma.mealPlan.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (activePlan && actualCost !== undefined) {
      await this.prisma.mealPlan.update({
        where: { id: activePlan.id },
        data: { actualCost },
      });
    }

    return {
      success: true,
      addedToPantryCount: checkedItems?.length || 0,
      actualCostLogged: actualCost !== undefined ? actualCost : activePlan?.totalEstimatedCost,
      message: actualCost !== undefined
        ? `All logged! You spent $${actualCost.toFixed(2)} on this plan.`
        : `Estimate kept ($${activePlan?.totalEstimatedCost.toFixed(2) || '0.00'}).`,
    };
  }
}

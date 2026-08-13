import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class MealPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async generateMealPlan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Deactivate existing active plans for user
    await this.prisma.mealPlan.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });

    // Fetch candidate meals matching user dietary restrictions
    let meals = await this.prisma.meal.findMany();

    if (meals.length === 0) {
      // Fallback dummy meal if DB not seeded yet
      meals = [
        {
          id: 'dummy-1',
          title: 'Chicken Caesar Wraps',
          description: 'Crispy chicken with classic Caesar dressing in warm tortillas',
          prepTimeMinutes: 15,
          servings: 4,
          estimatedCost: 20.0,
          cuisine: 'American',
          dietaryTags: ['HIGH_PROTEIN'],
          instructions: ['Slice chicken', 'Assemble wrap', 'Serve fresh'],
          ingredients: [
            { name: 'Olive oil', quantity: '1 tbsp' },
            { name: 'Garlic', quantity: '2 cloves' },
            { name: 'Mixed veg', quantity: '400g' },
            { name: 'Chicken breast', quantity: '500g' },
          ],
          imageUrl: null,
          cookedCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    const daysCount = user.plannedDaysCount || 7;
    const mealTypes = user.plannedMealTypes.length > 0
      ? user.plannedMealTypes
      : ['BREAKFAST', 'LUNCH', 'DINNER'];

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + daysCount);

    let totalCost = 0.0;
    const planItemsData: { mealId: string; dayOfWeek: number; mealType: string }[] = [];

    for (let day = 1; day <= daysCount; day++) {
      for (const mealType of mealTypes) {
        // Pick a meal round-robin or randomly
        const mealIndex = (day + mealTypes.indexOf(mealType)) % meals.length;
        const selectedMeal = meals[mealIndex];
        totalCost += selectedMeal.estimatedCost;

        if (selectedMeal.id !== 'dummy-1') {
          planItemsData.push({
            mealId: selectedMeal.id,
            dayOfWeek: day,
            mealType,
          });
        }
      }
    }

    const newPlan = await this.prisma.mealPlan.create({
      data: {
        userId,
        startDate,
        endDate,
        totalEstimatedCost: totalCost,
        status: 'ACTIVE',
        items: {
          create: planItemsData,
        },
      },
      include: {
        items: {
          include: {
            meal: true,
          },
        },
      },
    });

    const budgetDelta = totalCost - user.weeklyBudget;
    const isOverBudget = budgetDelta > 0;

    return {
      plan: newPlan,
      weeklyBudget: user.weeklyBudget,
      totalEstimatedCost: totalCost,
      budgetDelta: Math.abs(budgetDelta),
      isOverBudget,
      summaryMessage: isOverBudget
        ? `Est. cost $${totalCost.toFixed(2)} / $${user.weeklyBudget.toFixed(2)} → $${budgetDelta.toFixed(2)} over budget`
        : `Est. cost $${totalCost.toFixed(2)} / $${user.weeklyBudget.toFixed(2)} → $${Math.abs(budgetDelta).toFixed(2)} under budget`,
    };
  }

  async getCurrentPlan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const currentPlan = await this.prisma.mealPlan.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            meal: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
        },
      },
    });

    if (!currentPlan) {
      return {
        hasActivePlan: false,
        message: 'No active meal plan found. Generate a new plan to get started.',
      };
    }

    const weeklyBudget = user?.weeklyBudget || 150.0;
    const budgetDelta = currentPlan.totalEstimatedCost - weeklyBudget;
    const isOverBudget = budgetDelta > 0;

    return {
      hasActivePlan: true,
      plan: currentPlan,
      weeklyBudget,
      totalEstimatedCost: currentPlan.totalEstimatedCost,
      budgetDelta: Math.abs(budgetDelta),
      isOverBudget,
      summaryBanner: isOverBudget
        ? `Est. cost $${currentPlan.totalEstimatedCost.toFixed(2)} / $${weeklyBudget.toFixed(2)} → $${budgetDelta.toFixed(2)} over budget`
        : `Est. cost $${currentPlan.totalEstimatedCost.toFixed(2)} / $${weeklyBudget.toFixed(2)} → $${Math.abs(budgetDelta).toFixed(2)} under budget`,
    };
  }

  async swapMealItem(userId: string, itemId: string, newMealId?: string) {
    const item = await this.prisma.mealPlanItem.findUnique({
      where: { id: itemId },
      include: { mealPlan: true },
    });

    if (!item || item.mealPlan.userId !== userId) {
      throw new NotFoundException('Meal plan item not found');
    }

    let targetMealId = newMealId;
    if (!targetMealId) {
      // Pick a random alternative meal
      const alternatives = await this.prisma.meal.findMany({
        where: { id: { not: item.mealId } },
        take: 5,
      });
      if (alternatives.length > 0) {
        targetMealId = alternatives[Math.floor(Math.random() * alternatives.length)].id;
      } else {
        targetMealId = item.mealId;
      }
    }

    const updatedItem = await this.prisma.mealPlanItem.update({
      where: { id: itemId },
      data: { mealId: targetMealId },
      include: { meal: true },
    });

    return updatedItem;
  }
}

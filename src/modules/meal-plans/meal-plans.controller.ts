import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MealPlansService } from './meal-plans.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

@ApiTags('Meal Plans')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Trigger AI weekly meal plan generation based on budget and preferences' })
  @ApiResponse({ status: 201, description: 'Meal plan generated successfully' })
  async generateMealPlan(@CurrentUser('id') userId: string) {
    const result = await this.mealPlansService.generateMealPlan(userId);
    return {
      message: 'Weekly meal plan generated successfully',
      data: result,
    };
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current active weekly meal plan & budget comparison' })
  @ApiResponse({ status: 200, description: 'Active meal plan retrieved successfully' })
  async getCurrentPlan(@CurrentUser('id') userId: string) {
    const result = await this.mealPlansService.getCurrentPlan(userId);
    return {
      message: 'Current meal plan retrieved successfully',
      data: result,
    };
  }

  @Patch('swap/:itemId')
  @ApiOperation({ summary: 'Swap a planned meal item with another recipe' })
  @ApiResponse({ status: 200, description: 'Meal swapped successfully' })
  async swapMeal(
    @CurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
    @Body('newMealId') newMealId?: string,
  ) {
    const item = await this.mealPlansService.swapMealItem(userId, itemId, newMealId);
    return {
      message: 'Meal swapped successfully',
      data: item,
    };
  }
}

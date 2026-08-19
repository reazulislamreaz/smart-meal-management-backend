import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { MealPlansService } from './meal-plans.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { GenerateMealPlanDto } from './dto/generate-meal-plan.dto';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { UpdateMealPlanItemDto } from './dto/update-meal-plan-item.dto';

@ApiTags('Meal Plans')
@ApiBearerAuth()
@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Trigger AI weekly meal plan generation via OpenAI ChatGPT API',
    description:
      'Leverages OpenAI to create personalized, budget-conscious meal plans tailored to dietary restrictions, family size, kitchen equipment, and in-stock pantry items.',
  })
  @ApiBody({ type: GenerateMealPlanDto, required: false })
  @ApiResponse({ status: 201, description: 'AI meal plan generated successfully' })
  async generateMealPlan(
    @CurrentUser('id') userId: string,
    @Body() dto?: GenerateMealPlanDto,
  ) {
    const result = await this.mealPlansService.generateMealPlan(userId, dto);
    return {
      message: 'Weekly meal plan generated successfully',
      data: result,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom meal plan manually' })
  @ApiBody({ type: CreateMealPlanDto })
  @ApiResponse({ status: 201, description: 'Meal plan created successfully' })
  async createManualPlan(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMealPlanDto,
  ) {
    const result = await this.mealPlansService.createManualPlan(userId, dto);
    return {
      message: 'Custom meal plan created successfully',
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

  @Get('history')
  @ApiOperation({ summary: 'Get historical meal plans for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Meal plan history retrieved successfully' })
  async getPlanHistory(
    @CurrentUser('id') userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    const result = await this.mealPlansService.getPlanHistory(userId, page, limit);
    return {
      message: 'Meal plan history retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific meal plan by ID' })
  @ApiResponse({ status: 200, description: 'Meal plan retrieved successfully' })
  async getPlanById(
    @CurrentUser('id') userId: string,
    @Param('id') planId: string,
  ) {
    const plan = await this.mealPlansService.getPlanById(userId, planId);
    return {
      message: 'Meal plan retrieved successfully',
      data: plan,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a meal plan by ID' })
  @ApiResponse({ status: 200, description: 'Meal plan deleted successfully' })
  async deletePlan(
    @CurrentUser('id') userId: string,
    @Param('id') planId: string,
  ) {
    const result = await this.mealPlansService.deletePlan(userId, planId);
    return {
      message: result.message,
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

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update a planned meal item (day of week, meal slot, status)' })
  @ApiResponse({ status: 200, description: 'Meal plan item updated successfully' })
  async updateMealItem(
    @CurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMealPlanItemDto,
  ) {
    const item = await this.mealPlansService.updateMealPlanItem(userId, itemId, dto);
    return {
      message: 'Meal plan item updated successfully',
      data: item,
    };
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove a planned meal item from the current meal plan' })
  @ApiResponse({ status: 200, description: 'Meal plan item removed successfully' })
  async deleteMealItem(
    @CurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
  ) {
    const result = await this.mealPlansService.deleteMealPlanItem(userId, itemId);
    return {
      message: result.message,
      data: result,
    };
  }
}

import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { MealsService } from './meals.service';

@ApiTags('Meals')
@ApiBearerAuth()
@Controller('meals')
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter master recipe catalog' })
  @ApiQuery({ name: 'cuisine', required: false, type: String })
  @ApiQuery({ name: 'dietaryTag', required: false, type: String })
  @ApiQuery({ name: 'dietaryTags', required: false, type: String, description: 'Comma-separated tags e.g. VEGETARIAN,HIGH_PROTEIN' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'maxPrepTime', required: false, type: Number })
  @ApiQuery({ name: 'maxCost', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['title', 'estimatedCost', 'prepTimeMinutes', 'cookedCount', 'createdAt'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Recipe catalog retrieved successfully' })
  async findAll(
    @Query('cuisine') cuisine?: string,
    @Query('dietaryTag') dietaryTag?: string,
    @Query('dietaryTags') dietaryTags?: string,
    @Query('search') search?: string,
    @Query('maxPrepTime', new ParseIntPipe({ optional: true })) maxPrepTime?: number,
    @Query('maxCost', new ParseIntPipe({ optional: true })) maxCost?: number,
    @Query('sortBy') sortBy?: 'title' | 'estimatedCost' | 'prepTimeMinutes' | 'cookedCount' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    const result = await this.mealsService.findAll({
      cuisine,
      dietaryTag,
      dietaryTags,
      search,
      maxPrepTime,
      maxCost,
      sortBy,
      sortOrder,
      page,
      limit,
    });
    return {
      message: 'Meals retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recipe details by ID' })
  @ApiResponse({ status: 200, description: 'Meal details retrieved successfully' })
  async findOne(@Param('id') id: string) {
    const meal = await this.mealsService.findById(id);
    return {
      message: 'Meal details retrieved successfully',
      data: meal,
    };
  }
}

import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CookbookService } from './cookbook.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

@ApiTags('Cookbook & Favourites')
@ApiBearerAuth()
@Controller('meals')
export class CookbookController {
  constructor(private readonly cookbookService: CookbookService) {}

  @Post(':id/cook')
  @ApiOperation({ summary: 'Log a meal as cooked in user Cookbook (Cook Now flow)' })
  @ApiResponse({ status: 201, description: 'Meal logged as cooked' })
  async logCooked(
    @CurrentUser('id') userId: string,
    @Param('id') mealId: string,
    @Body() body: { photoUrl?: string; notes?: string },
  ) {
    const log = await this.cookbookService.logMealAsCooked(userId, mealId, body.photoUrl, body.notes);
    return {
      message: `Bon appétit! Logged in your cookbook.`,
      data: log,
    };
  }

  @Post(':id/favourite')
  @ApiOperation({ summary: 'Toggle recipe favourite status for user' })
  @ApiResponse({ status: 200, description: 'Favourite status toggled' })
  async toggleFavourite(
    @CurrentUser('id') userId: string,
    @Param('id') mealId: string,
  ) {
    const result = await this.cookbookService.toggleFavourite(userId, mealId);
    return {
      message: result.message,
      data: result,
    };
  }

  @Get('cookbook/my-cooked')
  @ApiOperation({ summary: 'Get user cooked meal history log' })
  @ApiResponse({ status: 200, description: 'Cooked meal logs retrieved successfully' })
  async getMyCooked(@CurrentUser('id') userId: string) {
    const logs = await this.cookbookService.getMyCookedHistory(userId);
    return {
      message: 'Cooked meals retrieved successfully',
      data: logs,
    };
  }

  @Get('cookbook/favourites')
  @ApiOperation({ summary: 'Get user favourite saved recipes' })
  @ApiResponse({ status: 200, description: 'Favourite recipes retrieved successfully' })
  async getMyFavourites(@CurrentUser('id') userId: string) {
    const recipes = await this.cookbookService.getMyFavourites(userId);
    return {
      message: 'Favourite recipes retrieved successfully',
      data: recipes,
    };
  }
}

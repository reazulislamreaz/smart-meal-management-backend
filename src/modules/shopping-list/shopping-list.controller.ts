import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ShoppingListService } from './shopping-list.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

@ApiTags('Shopping List')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('shopping-list')
export class ShoppingListController {
  constructor(private readonly shoppingListService: ShoppingListService) {}

  @Get()
  @ApiOperation({ summary: 'Get auto-deducted grocery shopping list for current meal plan' })
  @ApiResponse({ status: 200, description: 'Shopping list generated successfully' })
  async getShoppingList(@CurrentUser('id') userId: string) {
    const result = await this.shoppingListService.getShoppingList(userId);
    return {
      message: 'Shopping list retrieved successfully',
      data: result,
    };
  }

  @Post('finish')
  @ApiOperation({ summary: 'Finish shopping flow: transfer checked items to pantry stock & log actual spend' })
  @ApiResponse({ status: 200, description: 'Shopping session finished' })
  async finishShopping(
    @CurrentUser('id') userId: string,
    @Body() body: { checkedItems: { name: string; category?: string }[]; actualCost?: number },
  ) {
    const result = await this.shoppingListService.finishShoppingSession(
      userId,
      body.checkedItems || [],
      body.actualCost,
    );
    return {
      message: result.message,
      data: result,
    };
  }
}

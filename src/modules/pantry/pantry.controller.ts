import { Controller, Get, Post, Delete, Body, Param, Query, ParseIntPipe, ParseBoolPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PantryService } from './pantry.service';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

@ApiTags('Pantry')
@ApiBearerAuth()
@Controller('pantry')
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Get()
  @ApiOperation({ summary: 'List current user pantry inventory with search and category filtering' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'isLowStock', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Pantry items retrieved successfully' })
  async getPantry(
    @CurrentUser('id') userId: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('isLowStock', new ParseBoolPipe({ optional: true })) isLowStock?: boolean,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    const result = await this.pantryService.getUserPantry(userId, {
      search,
      category,
      isLowStock,
      page,
      limit,
    });
    return {
      message: 'Pantry items retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Add an item to user pantry inventory' })
  @ApiResponse({ status: 201, description: 'Pantry item added successfully' })
  async addPantryItem(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePantryItemDto,
  ) {
    const item = await this.pantryService.addPantryItem(userId, dto);
    return {
      message: 'Pantry item added successfully',
      data: item,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove an item from pantry' })
  @ApiResponse({ status: 200, description: 'Pantry item deleted successfully' })
  async deletePantryItem(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.pantryService.deletePantryItem(userId, id);
    return {
      message: 'Pantry item deleted successfully',
    };
  }
}

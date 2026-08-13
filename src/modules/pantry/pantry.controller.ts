import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PantryService } from './pantry.service';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

@ApiTags('Pantry')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('pantry')
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Get()
  @ApiOperation({ summary: 'List current user pantry inventory' })
  @ApiResponse({ status: 200, description: 'Pantry items retrieved successfully' })
  async getPantry(@CurrentUser('id') userId: string) {
    const items = await this.pantryService.getUserPantry(userId);
    return {
      message: 'Pantry items retrieved successfully',
      data: items,
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

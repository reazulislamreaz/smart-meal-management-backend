import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { PantryService } from "./pantry.service";
import { CreatePantryItemDto } from "./dto/create-pantry-item.dto";
import { UpdatePantryItemDto } from "./dto/update-pantry-item.dto";
import { CurrentUser } from "@/common/decorators/current-user.decorator";

@ApiTags("Pantry")
@ApiBearerAuth()
@Controller("pantry")
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Get()
  @ApiOperation({
    summary:
      "List current user pantry inventory with search and category filtering",
  })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "category", required: false, type: String })
  @ApiQuery({ name: "isLowStock", required: false, type: Boolean })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Pantry items retrieved successfully",
  })
  async getPantry(
    @CurrentUser("id") userId: string,
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("isLowStock", new ParseBoolPipe({ optional: true }))
    isLowStock?: boolean,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    const result = await this.pantryService.getUserPantry(userId, {
      search,
      category,
      isLowStock,
      page,
      limit,
    });
    return {
      message: "Pantry items retrieved successfully",
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get specific pantry item by ID" })
  @ApiParam({ name: "id", description: "Pantry item ID" })
  @ApiResponse({
    status: 200,
    description: "Pantry item retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Pantry item not found" })
  async getPantryItem(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
  ) {
    const item = await this.pantryService.getPantryItemById(userId, id);
    return {
      message: "Pantry item retrieved successfully",
      data: item,
    };
  }

  @Post()
  @ApiOperation({
    summary: "Add an item to user pantry inventory (expiryDate is optional)",
  })
  @ApiBody({ type: CreatePantryItemDto })
  @ApiResponse({ status: 201, description: "Pantry item added successfully" })
  async addPantryItem(
    @CurrentUser("id") userId: string,
    @Body() dto: CreatePantryItemDto,
  ) {
    const item = await this.pantryService.addPantryItem(userId, dto);
    return {
      message: "Pantry item added successfully",
      data: item,
    };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an existing pantry item" })
  @ApiParam({ name: "id", description: "Pantry item ID" })
  @ApiBody({ type: UpdatePantryItemDto })
  @ApiResponse({ status: 200, description: "Pantry item updated successfully" })
  @ApiResponse({ status: 404, description: "Pantry item not found" })
  async updatePantryItem(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: UpdatePantryItemDto,
  ) {
    const item = await this.pantryService.updatePantryItem(userId, id, dto);
    return {
      message: "Pantry item updated successfully",
      data: item,
    };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove an item from pantry" })
  @ApiParam({ name: "id", description: "Pantry item ID" })
  @ApiResponse({ status: 200, description: "Pantry item deleted successfully" })
  async deletePantryItem(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
  ) {
    await this.pantryService.deletePantryItem(userId, id);
    return {
      message: "Pantry item deleted successfully",
    };
  }
}

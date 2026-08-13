import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOnboardingDto } from './dto/onboarding.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.createUser(createUserDto);
    return {
      message: 'User created successfully',
      data: user,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      message: 'User profile retrieved successfully',
      data: user,
    };
  }

  @Patch('onboarding')
  @ApiOperation({ summary: 'Update user onboarding step data and preferences' })
  @ApiResponse({ status: 200, description: 'Onboarding step updated successfully' })
  async updateOnboarding(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOnboardingDto,
  ) {
    const user = await this.usersService.updateOnboarding(userId, dto);
    return {
      message: 'Onboarding step updated successfully',
      data: user,
    };
  }

  @Get('onboarding/status')
  @ApiOperation({ summary: 'Get current user onboarding step and preferences status' })
  @ApiResponse({ status: 200, description: 'Onboarding status retrieved successfully' })
  async getOnboardingStatus(@CurrentUser('id') userId: string) {
    const status = await this.usersService.getOnboardingStatus(userId);
    return {
      message: 'Onboarding status retrieved successfully',
      data: status,
    };
  }

  @Post('onboarding/complete')
  @ApiOperation({ summary: 'Mark 8-step onboarding flow as complete' })
  @ApiResponse({ status: 200, description: 'Onboarding marked as complete' })
  async completeOnboarding(
    @CurrentUser('id') userId: string,
    @Body() dto?: UpdateOnboardingDto,
  ) {
    const user = await this.usersService.completeOnboarding(userId, dto);
    return {
      message: 'Onboarding completed successfully',
      data: user,
    };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update active user profile (name, phone, avatar)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.updateUser(userId, dto);
    return {
      message: 'Profile updated successfully',
      data: user,
    };
  }

  @Patch('change-password')
  @ApiOperation({ summary: 'Change user account password modal flow' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    const result = await this.usersService.changePassword(userId, body.currentPassword, body.newPassword);
    return {
      message: result.message,
      data: result,
    };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users paginated (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    const result = await this.usersService.findAll(page, limit);
    return {
      message: 'Users retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return {
      message: 'User retrieved successfully',
      data: user,
    };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user profile by ID (Admin only)' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.updateUser(id, updateUserDto);
    return {
      message: 'User updated successfully',
      data: user,
    };
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete user by ID (Super Admin only)' })
  async remove(@Param('id') id: string) {
    await this.usersService.deleteUser(id);
    return {
      message: 'User deleted successfully',
      data: null,
    };
  }
}

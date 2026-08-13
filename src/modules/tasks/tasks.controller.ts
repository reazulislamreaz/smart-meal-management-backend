import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List current user household tasks' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  async getTasks(@CurrentUser('id') userId: string) {
    const tasks = await this.tasksService.getUserTasks(userId);
    return {
      message: 'Tasks retrieved successfully',
      data: tasks,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a household prep or shopping task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  async createTask(
    @CurrentUser('id') userId: string,
    @Body() dto: { title: string; description?: string; dueDate?: string },
  ) {
    const task = await this.tasksService.createTask(userId, dto);
    return {
      message: 'Task created successfully',
      data: task,
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task progress/completion status (PENDING, IN_PROGRESS, COMPLETED)' })
  @ApiResponse({ status: 200, description: 'Task status updated successfully' })
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const task = await this.tasksService.updateTaskStatus(userId, id, status);
    return {
      message: 'Task status updated successfully',
      data: task,
    };
  }
}

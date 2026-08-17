import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserTasks(
    userId: string,
    query?: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (query?.status) {
      where.status = query.status.toUpperCase();
    }

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createTask(userId: string, dto: { title: string; description?: string; dueDate?: string }) {
    const task = await this.prisma.task.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: 'PENDING',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'TASK_CREATED',
        entity: 'Task',
        entityId: task.id,
        details: { title: task.title, status: task.status },
        ipAddress: '127.0.0.1',
      },
    }).catch(() => null);

    return task;
  }

  async updateTaskStatus(userId: string, id: string, status: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'TASK_STATUS_UPDATED',
        entity: 'Task',
        entityId: updatedTask.id,
        details: { title: updatedTask.title, previousStatus: task.status, newStatus: status },
        ipAddress: '127.0.0.1',
      },
    }).catch(() => null);

    return updatedTask;
  }
}

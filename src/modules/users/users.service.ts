import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findById(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    const { passwordHash, ...result } = user;
    return result;
  }

  async findByEmailInternal(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findAll(page = 1, limit = 10): Promise<{ data: Omit<User, 'passwordHash'>[]; meta: any }> {
    const skip = (page - 1) * limit;
    const { users, total } = await this.usersRepository.findAll({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const sanitizedUsers = users.map(({ passwordHash, ...user }) => user);

    return {
      data: sanitizedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>> {
    await this.findById(id);

    const updateData: any = { ...dto };
    if (dto.password) {
      updateData.passwordHash = await argon2.hash(dto.password);
      delete updateData.password;
    }

    const updated = await this.usersRepository.update(id, updateData);
    const { passwordHash, ...result } = updated;
    return result;
  }

  async deleteUser(id: string): Promise<void> {
    await this.findById(id);
    await this.usersRepository.delete(id);
  }
}

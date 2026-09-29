import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { buildPaginatedResult, type PaginatedDto } from '../../common/dto/paginated-result.dto.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { Prisma, Role, type Task } from '../../infra/prisma/prisma.client.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { QueryTasksDto } from './dto/query-tasks.dto.js';
import { TaskResponseDto } from './dto/task-response.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import { TasksRepository } from './tasks.repository.js';

/**
 * Módulo de referência do template.
 *
 * Copie a estrutura deste diretório ao criar um recurso novo: DTOs para a
 * fronteira HTTP, repositório para o acesso a dados, service para a regra, e
 * controller sem lógica alguma.
 *
 * A regra de visibilidade aqui é a mais comum em APIs multiusuário: quem tem
 * papel ADMIN enxerga tudo, qualquer outro enxerga apenas o que é seu. Ela vive
 * no service, e não no controller, para valer também quando outro service
 * chamar estes métodos.
 */
@Injectable()
export class TasksService {
  constructor(private readonly repository: TasksRepository) {}

  async create(dto: CreateTaskDto, actor: AuthenticatedUser): Promise<TaskResponseDto> {
    const task = await this.repository.create({
      title: dto.title,
      description: dto.description ?? null,
      ...(dto.status === undefined ? {} : { status: dto.status }),
      dueDate: dto.dueDate ?? null,
      ownerId: actor.id,
    });

    return TaskResponseDto.fromEntity(task);
  }

  async findAll(
    query: QueryTasksDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedDto<TaskResponseDto>> {
    const where: Prisma.TaskWhereInput = {
      ...this.visibilityFilter(query, actor),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [tasks, total] = await this.repository.findManyPaginated({
      where,
      skip: query.skip,
      take: query.limit,
      order: query.order,
    });

    return buildPaginatedResult(tasks.map(TaskResponseDto.fromEntity), total, query);
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<TaskResponseDto> {
    return TaskResponseDto.fromEntity(await this.findOwnedOrFail(id, actor));
  }

  async update(id: string, dto: UpdateTaskDto, actor: AuthenticatedUser): Promise<TaskResponseDto> {
    await this.findOwnedOrFail(id, actor);

    const task = await this.repository.update(id, {
      ...(dto.title === undefined ? {} : { title: dto.title }),
      ...(dto.description === undefined ? {} : { description: dto.description }),
      ...(dto.status === undefined ? {} : { status: dto.status }),
      ...(dto.dueDate === undefined ? {} : { dueDate: dto.dueDate }),
    });

    return TaskResponseDto.fromEntity(task);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.findOwnedOrFail(id, actor);
    await this.repository.delete(id);
  }

  private visibilityFilter(query: QueryTasksDto, actor: AuthenticatedUser): Prisma.TaskWhereInput {
    if (actor.role !== Role.ADMIN) {
      return { ownerId: actor.id };
    }

    return query.ownerId ? { ownerId: query.ownerId } : {};
  }

  private async findOwnedOrFail(id: string, actor: AuthenticatedUser): Promise<Task> {
    const task = await this.repository.findById(id);

    if (!task) {
      throw new NotFoundException(`Tarefa ${id} não encontrada`);
    }

    if (actor.role !== Role.ADMIN && task.ownerId !== actor.id) {
      throw new ForbiddenException('Esta tarefa pertence a outro usuário');
    }

    return task;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { Prisma, type Task } from '../../infra/prisma/prisma.client.js';

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TaskUncheckedCreateInput): Promise<Task> {
    return this.prisma.task.create({ data });
  }

  findById(id: string): Promise<Task | null> {
    return this.prisma.task.findUnique({ where: { id } });
  }

  findManyPaginated(params: {
    where: Prisma.TaskWhereInput;
    skip: number;
    take: number;
    order: Prisma.SortOrder;
  }): Promise<[Task[], number]> {
    const { where, skip, take, order } = params;

    return this.prisma.$transaction([
      this.prisma.task.findMany({ where, skip, take, orderBy: { createdAt: order } }),
      this.prisma.task.count({ where }),
    ]);
  }

  update(id: string, data: Prisma.TaskUpdateInput): Promise<Task> {
    return this.prisma.task.update({ where: { id }, data });
  }

  delete(id: string): Promise<Task> {
    return this.prisma.task.delete({ where: { id } });
  }
}

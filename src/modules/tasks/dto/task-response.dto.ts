import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, type Task } from '../../../infra/prisma/prisma.client.js';

export class TaskResponseDto {
  id!: string;

  title!: string;

  /** Texto livre, opcional. */
  description!: string | null;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status!: TaskStatus;

  /** Prazo, se houver. */
  dueDate!: Date | null;

  /** Id do usuário dono da tarefa. */
  ownerId!: string;

  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(task: Task): TaskResponseDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
      ownerId: task.ownerId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}

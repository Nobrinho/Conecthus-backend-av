import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { Role, TaskStatus, type Task } from '../../infra/prisma/prisma.client.js';
import type { QueryTasksDto } from './dto/query-tasks.dto.js';
import { TasksService } from './tasks.service.js';
import type { TasksRepository } from './tasks.repository.js';

const ana: AuthenticatedUser = { id: 'user-ana', email: 'ana@exemplo.com', role: Role.USER };
const bruno: AuthenticatedUser = { id: 'user-bruno', email: 'bruno@exemplo.com', role: Role.USER };
const admin: AuthenticatedUser = { id: 'user-admin', email: 'admin@exemplo.com', role: Role.ADMIN };

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Tarefa',
  description: null,
  status: TaskStatus.TODO,
  dueDate: null,
  ownerId: ana.id,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildQuery = (overrides: Partial<QueryTasksDto> = {}): QueryTasksDto =>
  ({
    page: 1,
    limit: 20,
    order: 'desc',
    skip: 0,
    ...overrides,
  }) as QueryTasksDto;

describe('TasksService', () => {
  let repository: {
    [K in keyof TasksRepository]: ReturnType<typeof vi.fn>;
  };
  let service: TasksService;

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      findManyPaginated: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    service = new TasksService(repository as unknown as TasksRepository);
  });

  describe('create', () => {
    it('atribui a tarefa a quem está autenticado, ignorando qualquer dono enviado', async () => {
      repository.create.mockResolvedValue(buildTask());

      await service.create({ title: 'Tarefa' }, ana);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Tarefa', ownerId: ana.id }),
      );
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      repository.findManyPaginated.mockResolvedValue([[buildTask()], 1]);
    });

    it('restringe a consulta de um usuário comum às próprias tarefas', async () => {
      await service.findAll(buildQuery(), ana);

      expect(repository.findManyPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ ownerId: ana.id }) }),
      );
    });

    it('ignora o filtro por dono quando quem pede não é administrador', async () => {
      await service.findAll(buildQuery({ ownerId: bruno.id }), ana);

      expect(repository.findManyPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ ownerId: ana.id }) }),
      );
    });

    it('não restringe o dono para administradores', async () => {
      await service.findAll(buildQuery(), admin);

      const { where } = repository.findManyPaginated.mock.calls[0][0];
      expect(where).not.toHaveProperty('ownerId');
    });

    it('respeita o filtro por dono quando quem pede é administrador', async () => {
      await service.findAll(buildQuery({ ownerId: bruno.id }), admin);

      expect(repository.findManyPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ ownerId: bruno.id }) }),
      );
    });

    it('calcula o meta da paginação a partir do total', async () => {
      repository.findManyPaginated.mockResolvedValue([[buildTask()], 7]);

      const result = await service.findAll(buildQuery({ page: 2, limit: 3, skip: 3 }), ana);

      expect(result.meta).toEqual({
        total: 7,
        page: 2,
        limit: 3,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('devolve totalPages zero quando não há resultado', async () => {
      repository.findManyPaginated.mockResolvedValue([[], 0]);

      const result = await service.findAll(buildQuery(), ana);

      expect(result.meta).toMatchObject({ total: 0, totalPages: 0, hasNextPage: false });
    });
  });

  describe('findOne', () => {
    it('devolve a tarefa para o dono', async () => {
      repository.findById.mockResolvedValue(buildTask());

      await expect(service.findOne('task-1', ana)).resolves.toMatchObject({ id: 'task-1' });
    });

    it('recusa o acesso de outro usuário comum', async () => {
      repository.findById.mockResolvedValue(buildTask());

      await expect(service.findOne('task-1', bruno)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite que o administrador leia a tarefa alheia', async () => {
      repository.findById.mockResolvedValue(buildTask());

      await expect(service.findOne('task-1', admin)).resolves.toMatchObject({ ownerId: ana.id });
    });

    it('lança NotFound quando a tarefa não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('task-1', ana)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('envia ao repositório apenas os campos presentes no DTO', async () => {
      repository.findById.mockResolvedValue(buildTask());
      repository.update.mockResolvedValue(buildTask({ status: TaskStatus.DONE }));

      await service.update('task-1', { status: TaskStatus.DONE }, ana);

      expect(repository.update).toHaveBeenCalledWith('task-1', { status: TaskStatus.DONE });
    });

    it('não atualiza tarefa de outro usuário', async () => {
      repository.findById.mockResolvedValue(buildTask());

      await expect(service.update('task-1', { title: 'x' }, bruno)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('não remove tarefa de outro usuário', async () => {
      repository.findById.mockResolvedValue(buildTask());

      await expect(service.remove('task-1', bruno)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  API,
  bearer,
  createTestApp,
  registerAdmin,
  registerUser,
  type TestContext,
  type TestUser,
} from './utils/test-app.js';

describe('Tarefas (e2e)', () => {
  let ctx: TestContext;
  let ana: TestUser;
  let bruno: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.prisma.truncateAll();
    ana = await registerUser(ctx, { name: 'Ana' });
    bruno = await registerUser(ctx, { name: 'Bruno' });
    admin = await registerAdmin(ctx);
  });

  const createTask = (owner: TestUser, title: string) =>
    ctx.http.post(`${API}/tasks`).set('Authorization', bearer(owner)).send({ title });

  it('cria a tarefa em nome do usuário autenticado', async () => {
    const response = await createTask(ana, 'Escrever os testes').expect(201);

    expect(response.body).toMatchObject({
      title: 'Escrever os testes',
      status: 'TODO',
      ownerId: ana.id,
    });
  });

  it('recusa corpo inválido com 400', async () => {
    const response = await ctx.http
      .post(`${API}/tasks`)
      .set('Authorization', bearer(ana))
      .send({ titulo: 'campo errado' })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body).toHaveProperty('requestId');
  });

  it('exige autenticação', async () => {
    await ctx.http.get(`${API}/tasks`).expect(401);
  });

  describe('listagem', () => {
    beforeEach(async () => {
      await createTask(ana, 'Tarefa da Ana 1').expect(201);
      await createTask(ana, 'Tarefa da Ana 2').expect(201);
      await createTask(bruno, 'Tarefa do Bruno').expect(201);
    });

    it('mostra ao usuário comum apenas as próprias tarefas', async () => {
      const response = await ctx.http
        .get(`${API}/tasks`)
        .set('Authorization', bearer(ana))
        .expect(200);

      expect(response.body.meta.total).toBe(2);
      expect(response.body.data.every((task: { ownerId: string }) => task.ownerId === ana.id)).toBe(
        true,
      );
    });

    it('mostra ao administrador as tarefas de todo mundo', async () => {
      const response = await ctx.http
        .get(`${API}/tasks`)
        .set('Authorization', bearer(admin))
        .expect(200);

      expect(response.body.meta.total).toBe(3);
    });

    it('deixa o administrador filtrar por dono', async () => {
      const response = await ctx.http
        .get(`${API}/tasks`)
        .query({ ownerId: bruno.id })
        .set('Authorization', bearer(admin))
        .expect(200);

      expect(response.body.meta.total).toBe(1);
      expect(response.body.data[0].ownerId).toBe(bruno.id);
    });

    it('pagina e preenche o meta corretamente', async () => {
      const response = await ctx.http
        .get(`${API}/tasks`)
        .query({ page: 1, limit: 1 })
        .set('Authorization', bearer(ana))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta).toMatchObject({
        total: 2,
        page: 1,
        limit: 1,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it('filtra pela busca no título', async () => {
      const response = await ctx.http
        .get(`${API}/tasks`)
        .query({ search: 'ana 1' })
        .set('Authorization', bearer(ana))
        .expect(200);

      expect(response.body.meta.total).toBe(1);
    });

    it('recusa limite acima do máximo com 400', async () => {
      await ctx.http
        .get(`${API}/tasks`)
        .query({ limit: 500 })
        .set('Authorization', bearer(ana))
        .expect(400);
    });
  });

  describe('acesso a uma tarefa específica', () => {
    let taskId: string;

    beforeEach(async () => {
      const response = await createTask(ana, 'Tarefa privada da Ana').expect(201);
      taskId = response.body.id;
    });

    it('devolve a tarefa ao dono', async () => {
      await ctx.http.get(`${API}/tasks/${taskId}`).set('Authorization', bearer(ana)).expect(200);
    });

    it('responde 403 para outro usuário comum', async () => {
      await ctx.http.get(`${API}/tasks/${taskId}`).set('Authorization', bearer(bruno)).expect(403);
    });

    it('deixa o administrador ler a tarefa alheia', async () => {
      await ctx.http.get(`${API}/tasks/${taskId}`).set('Authorization', bearer(admin)).expect(200);
    });

    it('atualiza apenas os campos enviados', async () => {
      const response = await ctx.http
        .patch(`${API}/tasks/${taskId}`)
        .set('Authorization', bearer(ana))
        .send({ status: 'DONE' })
        .expect(200);

      expect(response.body).toMatchObject({ status: 'DONE', title: 'Tarefa privada da Ana' });
    });

    it('impede outro usuário de atualizar', async () => {
      await ctx.http
        .patch(`${API}/tasks/${taskId}`)
        .set('Authorization', bearer(bruno))
        .send({ title: 'sequestrada' })
        .expect(403);
    });

    it('remove e depois responde 404', async () => {
      await ctx.http.delete(`${API}/tasks/${taskId}`).set('Authorization', bearer(ana)).expect(204);
      await ctx.http.get(`${API}/tasks/${taskId}`).set('Authorization', bearer(ana)).expect(404);
    });

    it('responde 400 para id que não é UUID', async () => {
      await ctx.http.get(`${API}/tasks/123`).set('Authorization', bearer(ana)).expect(400);
    });
  });
});

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/config/app-setup.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { Role } from '../../src/infra/prisma/prisma.client.js';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  /** Cliente HTTP já apontado para a instância em memória. */
  http: TestAgent;
  close: () => Promise<void>;
}

/**
 * Sobe a aplicação inteira em memória para os testes e2e.
 *
 * Usa o mesmo `configureApp` do `main.ts`, então validação, prefixo,
 * versionamento e tratamento de erro são idênticos aos de produção. Um helper
 * que montasse a aplicação por conta própria testaria outra coisa.
 */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication({ bufferLogs: true });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  await prisma.truncateAll();

  return {
    app,
    prisma,
    http: request(app.getHttpServer()),
    close: async () => {
      await prisma.truncateAll();
      await app.close();
    },
  };
}

export const API = '/api/v1';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

/** Cria uma conta pela própria API e devolve os tokens já emitidos. */
export async function registerUser(
  ctx: TestContext,
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<TestUser> {
  const payload = {
    email:
      overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemplo.com`,
    name: overrides.name ?? 'Pessoa de Teste',
    password: overrides.password ?? 'senhaSegura1',
  };

  const response = await ctx.http.post(`${API}/auth/register`).send(payload).expect(201);

  return {
    id: response.body.user.id,
    email: payload.email,
    password: payload.password,
    accessToken: response.body.tokens.accessToken,
    refreshToken: response.body.tokens.refreshToken,
  };
}

/**
 * Promove a conta a ADMIN direto no banco e faz login de novo, porque o papel
 * viaja dentro do access token e o antigo continuaria valendo como USER.
 */
export async function registerAdmin(ctx: TestContext): Promise<TestUser> {
  const user = await registerUser(ctx, { name: 'Administradora' });

  await ctx.prisma.user.update({ where: { id: user.id }, data: { role: Role.ADMIN } });

  const response = await ctx.http
    .post(`${API}/auth/login`)
    .send({ email: user.email, password: user.password })
    .expect(200);

  return {
    ...user,
    accessToken: response.body.tokens.accessToken,
    refreshToken: response.body.tokens.refreshToken,
  };
}

export const bearer = (user: TestUser): string => `Bearer ${user.accessToken}`;

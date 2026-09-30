import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/config/app-setup.js';
import { MailService, type MailMessage } from '../../src/infra/mail/mail.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  /** Cliente HTTP já apontado para a instância em memória. */
  http: TestAgent;
  /** E-mails que a aplicação "enviou" durante o teste. */
  outbox: MailMessage[];
  close: () => Promise<void>;
}

/**
 * Sobe a aplicação inteira em memória para os testes e2e.
 *
 * Usa o mesmo `configureApp` do `main.ts`, então validação, prefixo,
 * versionamento e tratamento de erro são idênticos aos de produção. Só o envio
 * de e-mail é trocado por uma caixa de saída em memória.
 */
export async function createTestApp(): Promise<TestContext> {
  const outbox: MailMessage[] = [];

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({ send: async (message: MailMessage) => void outbox.push(message) })
    .compile();

  const app = moduleRef.createNestApplication({ bufferLogs: true });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  await prisma.truncateAll();

  return {
    app,
    prisma,
    http: request(app.getHttpServer()),
    outbox,
    close: async () => {
      await prisma.truncateAll();
      await app.close();
    },
  };
}

export const API = '/api/v1';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  registration: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

let sequence = 0;

/**
 * Cria uma conta direto no banco, já que não há autocadastro, e faz login pela
 * API para obter tokens reais.
 */
export async function createUser(
  ctx: TestContext,
  overrides: Partial<{ name: string; email: string; registration: string; password: string }> = {},
): Promise<TestUser> {
  sequence += 1;
  const data = {
    name: overrides.name ?? 'Pessoa de Teste',
    email: overrides.email ?? `pessoa${sequence}.${Date.now() % 100000}@exemplo.com`,
    registration: overrides.registration ?? String(900000 + sequence),
    password: overrides.password ?? 'abc123',
  };

  const user = await ctx.prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      registration: data.registration,
      passwordHash: await argon2.hash(data.password, { type: argon2.argon2id }),
    },
  });

  const response = await ctx.http
    .post(`${API}/auth/login`)
    .send({ login: data.email, password: data.password })
    .expect(200);

  return {
    id: user.id,
    ...data,
    accessToken: response.body.tokens.accessToken,
    refreshToken: response.body.tokens.refreshToken,
  };
}

export const bearer = (user: TestUser): string => `Bearer ${user.accessToken}`;

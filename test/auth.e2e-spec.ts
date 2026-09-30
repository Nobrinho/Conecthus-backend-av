import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createTestApp, createUser, type TestContext } from './utils/test-app.js';

describe('Autenticação (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /auth/login', () => {
    it('autentica com as credenciais corretas', async () => {
      const user = await createUser(ctx);

      const response = await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: user.email, password: user.password })
        .expect(200);

      expect(response.body.user.email).toBe(user.email);
    });

    it('responde 401 para senha errada', async () => {
      const user = await createUser(ctx);

      await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: user.email, password: 'errad1' })
        .expect(401);
    });

    it('responde 401 para email inexistente', async () => {
      await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: 'ninguem@exemplo.com', password: 'abc123' })
        .expect(401);
    });

    it('usa a mesma mensagem do protótipo para qualquer falha de credencial', async () => {
      const response = await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: '123456', password: 'abc123' })
        .expect(401);

      expect(response.body.message).toBe('Usuário/Senha inválido(a)');
    });

    it('autentica pela matrícula', async () => {
      const user = await createUser(ctx);

      const response = await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: user.registration, password: user.password })
        .expect(200);

      expect(response.body.user.id).toBe(user.id);
    });

    it('responde 400 com os campos vazios', async () => {
      const response = await ctx.http.post(`${API}/auth/login`).send({}).expect(400);

      expect(response.body.message).toEqual(expect.arrayContaining(['Campo obrigatório']));
    });

    it('responde 401 para conta desativada', async () => {
      const user = await createUser(ctx);
      await ctx.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

      await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: user.email, password: user.password })
        .expect(401);
    });
  });

  describe('recuperação de senha', () => {
    it('responde 404 para e-mail não cadastrado', async () => {
      const response = await ctx.http
        .post(`${API}/auth/forgot-password`)
        .send({ email: 'ninguem@exemplo.com' })
        .expect(404);

      expect(response.body.message).toBe('E-mail não cadastrado');
    });

    it('envia o link, troca a senha pelo token e o token não serve de novo', async () => {
      const user = await createUser(ctx);

      await ctx.http.post(`${API}/auth/forgot-password`).send({ email: user.email }).expect(204);

      const message = ctx.outbox.at(-1)!;
      expect(message.to).toBe(user.email);
      const token = /token=([\w-]+)/.exec(message.text)![1]!;

      await ctx.http
        .post(`${API}/auth/reset-password`)
        .send({ token, password: 'nova12' })
        .expect(204);

      await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: user.email, password: 'nova12' })
        .expect(200);
      await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: user.email, password: user.password })
        .expect(401);

      // Uso único, e as sessões abertas antes da troca foram encerradas.
      await ctx.http
        .post(`${API}/auth/reset-password`)
        .send({ token, password: 'outra1' })
        .expect(400);
      await ctx.http
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });

    it('recusa nova senha fora da regra', async () => {
      await ctx.http
        .post(`${API}/auth/reset-password`)
        .send({ token: 'qualquer', password: 'curta' })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('devolve o usuário do token', async () => {
      const user = await createUser(ctx);

      const response = await ctx.http
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(user.id);
    });

    it('responde 401 sem token', async () => {
      await ctx.http.get(`${API}/auth/me`).expect(401);
    });

    it('responde 401 com token malformado', async () => {
      await ctx.http.get(`${API}/auth/me`).set('Authorization', 'Bearer não-e-um-jwt').expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('devolve um par novo e invalida o refresh token usado', async () => {
      const user = await createUser(ctx);

      const renewed = await ctx.http
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(200);

      expect(renewed.body.tokens.refreshToken).not.toBe(user.refreshToken);

      // O token novo funciona.
      await ctx.http
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${renewed.body.tokens.accessToken}`)
        .expect(200);
    });

    it('encerra todas as sessões quando um refresh token é reapresentado', async () => {
      const user = await createUser(ctx);

      const renewed = await ctx.http
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(200);

      // Reuso do token antigo: além de falhar, derruba a sessão atual.
      await ctx.http
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(401);

      await ctx.http
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: renewed.body.tokens.refreshToken })
        .expect(401);
    });

    it('responde 401 para refresh token desconhecido', async () => {
      const user = await createUser(ctx);

      // Assinatura válida, mas a linha correspondente não existe mais.
      await ctx.prisma.refreshToken.deleteMany({ where: { userId: user.id } });

      await ctx.http
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('invalida a sessão e responde 204 mesmo repetindo a chamada', async () => {
      const user = await createUser(ctx);

      await ctx.http
        .post(`${API}/auth/logout`)
        .send({ refreshToken: user.refreshToken })
        .expect(204);
      await ctx.http
        .post(`${API}/auth/logout`)
        .send({ refreshToken: user.refreshToken })
        .expect(204);

      await ctx.http
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });

    it('logout-all derruba as sessões abertas do usuário', async () => {
      const user = await createUser(ctx);

      const other = await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: user.email, password: user.password })
        .expect(200);

      await ctx.http
        .post(`${API}/auth/logout-all`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(204);

      await ctx.http
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: other.body.tokens.refreshToken })
        .expect(401);
    });
  });
});

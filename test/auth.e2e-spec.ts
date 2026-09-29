import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createTestApp, registerUser, type TestContext } from './utils/test-app.js';

describe('Autenticação (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /auth/register', () => {
    it('cria a conta e devolve o par de tokens sem vazar o hash da senha', async () => {
      const response = await ctx.http
        .post(`${API}/auth/register`)
        .send({ email: 'novo@exemplo.com', name: 'Pessoa Nova', password: 'senhaSegura1' })
        .expect(201);

      expect(response.body.user).toMatchObject({ email: 'novo@exemplo.com', role: 'USER' });
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.tokens.tokenType).toBe('Bearer');
      expect(response.body.tokens.accessToken).toEqual(expect.any(String));
      expect(response.body.tokens.expiresIn).toBeGreaterThan(0);
    });

    it('recusa email já cadastrado com 409', async () => {
      const payload = { email: 'repetido@exemplo.com', name: 'Alguém', password: 'senhaSegura1' };

      await ctx.http.post(`${API}/auth/register`).send(payload).expect(201);
      await ctx.http.post(`${API}/auth/register`).send(payload).expect(409);
    });

    it('recusa senha fraca com 400 e explica a regra', async () => {
      const response = await ctx.http
        .post(`${API}/auth/register`)
        .send({ email: 'fraca@exemplo.com', name: 'Alguém', password: 'abc' })
        .expect(400);

      expect(String(response.body.message)).toContain('8 caracteres');
    });

    it('ignora a tentativa de se cadastrar já como ADMIN', async () => {
      const response = await ctx.http
        .post(`${API}/auth/register`)
        .send({
          email: 'esperto@exemplo.com',
          name: 'Alguém',
          password: 'senhaSegura1',
          role: 'ADMIN',
        })
        .expect(400);

      expect(String(response.body.message)).toContain('role');
    });
  });

  describe('POST /auth/login', () => {
    it('autentica com as credenciais corretas', async () => {
      const user = await registerUser(ctx);

      const response = await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: user.email, password: user.password })
        .expect(200);

      expect(response.body.user.email).toBe(user.email);
    });

    it('responde 401 para senha errada', async () => {
      const user = await registerUser(ctx);

      await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: user.email, password: 'senhaErrada1' })
        .expect(401);
    });

    it('responde 401 para email inexistente', async () => {
      await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: 'ninguem@exemplo.com', password: 'senhaSegura1' })
        .expect(401);
    });

    it('responde 401 para conta desativada', async () => {
      const user = await registerUser(ctx);
      await ctx.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

      await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: user.email, password: user.password })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('devolve o usuário do token', async () => {
      const user = await registerUser(ctx);

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
      const user = await registerUser(ctx);

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
      const user = await registerUser(ctx);

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
      const user = await registerUser(ctx);

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
      const user = await registerUser(ctx);

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
      const user = await registerUser(ctx);

      const other = await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: user.email, password: user.password })
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

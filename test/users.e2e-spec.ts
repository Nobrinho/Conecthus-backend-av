import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  API,
  bearer,
  createTestApp,
  createUser,
  type TestContext,
  type TestUser,
} from './utils/test-app.js';

const valid = {
  name: 'Adriano Machado Souza',
  email: 'adriano.machado@callidus.com.br',
  registration: '809987',
  password: 'abc123',
};

describe('Usuários (e2e)', () => {
  let ctx: TestContext;
  let actor: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await ctx.prisma.truncateAll();
    actor = await createUser(ctx, { name: 'Millena Souza', registration: '100001' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  const post = (body: object) =>
    ctx.http.post(`${API}/users`).set('Authorization', bearer(actor)).send(body);

  it('exige autenticação em todas as rotas', async () => {
    await ctx.http.get(`${API}/users`).expect(401);
    await ctx.http.post(`${API}/users`).send(valid).expect(401);
  });

  describe('POST /users', () => {
    it('cadastra e devolve o usuário sem senha nem hash', async () => {
      const response = await post(valid).expect(201);

      expect(response.body).toMatchObject({
        name: valid.name,
        email: valid.email,
        registration: valid.registration,
        updatedAt: null,
      });
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it.each([
      ['nome com números', { name: 'Adriano 2' }, 'O nome deve conter apenas letras'],
      ['nome com símbolos', { name: 'Adriano!' }, 'O nome deve conter apenas letras'],
      ['nome acima de 30', { name: 'A'.repeat(31) }, 'no máximo 30'],
      ['e-mail inválido', { email: 'adriano@' }, 'Informe um e-mail válido'],
      ['e-mail acima de 40', { email: `${'a'.repeat(35)}@x.com` }, 'no máximo 40'],
      ['matrícula com letras', { registration: '80a987' }, 'apenas números'],
      ['matrícula curta', { registration: '123' }, 'entre 4 e 10'],
      ['matrícula longa', { registration: '12345678901' }, 'entre 4 e 10'],
      ['senha com 5 caracteres', { password: 'abc12' }, '6 caracteres alfanuméricos'],
      ['senha com 7 caracteres', { password: 'abc1234' }, '6 caracteres alfanuméricos'],
      ['senha com símbolo', { password: 'abc12!' }, '6 caracteres alfanuméricos'],
    ])('recusa %s com 400', async (_, override, message) => {
      const response = await post({ ...valid, ...override }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain(message);
    });

    it('aceita nomes acentuados', async () => {
      await post({ ...valid, name: 'João Araújo' }).expect(201);
    });

    it('exige todos os campos', async () => {
      const response = await post({}).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'O nome é obrigatório',
          'O e-mail é obrigatório',
          'A matrícula é obrigatória',
          'A senha é obrigatória',
        ]),
      );
    });

    it.each([
      ['email', { registration: '555555', email: valid.email.toUpperCase() }],
      ['registration', { email: 'outro@exemplo.com' }],
    ])('responde 409 indicando o campo %s duplicado', async (field, override) => {
      await post(valid).expect(201);

      const response = await post({ ...valid, ...override }).expect(409);

      expect(response.body.field).toBe(field);
    });
  });

  describe('GET /users', () => {
    beforeEach(async () => {
      for (let i = 0; i < 20; i += 1) {
        await post({
          name: `Usuario ${String.fromCharCode(65 + i)}`,
          email: `usuario${i}@exemplo.com`,
          registration: String(5000 + i),
          password: 'abc123',
        }).expect(201);
      }
    });

    it('pagina de 15 em 15, em ordem alfabética', async () => {
      const first = await ctx.http
        .get(`${API}/users`)
        .set('Authorization', bearer(actor))
        .expect(200);

      expect(first.body.data).toHaveLength(15);
      expect(first.body.meta).toMatchObject({ total: 21, page: 1, limit: 15, totalPages: 2 });
      const names = first.body.data.map((u: { name: string }) => u.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

      const second = await ctx.http
        .get(`${API}/users?page=2`)
        .set('Authorization', bearer(actor))
        .expect(200);
      expect(second.body.data).toHaveLength(6);
    });

    it('busca por parte do nome sem diferenciar maiúsculas', async () => {
      const response = await ctx.http
        .get(`${API}/users?search=usuario%20c`)
        .set('Authorization', bearer(actor))
        .expect(200);

      expect(response.body.data.map((u: { name: string }) => u.name)).toEqual(['Usuario C']);
    });

    it('não busca por e-mail', async () => {
      const response = await ctx.http
        .get(`${API}/users?search=exemplo.com`)
        .set('Authorization', bearer(actor))
        .expect(200);

      expect(response.body.meta.total).toBe(0);
    });
  });

  describe('GET/PATCH/DELETE /users/:id', () => {
    let created: { id: string };

    beforeEach(async () => {
      created = (await post(valid).expect(201)).body;
    });

    it('busca pelo id', async () => {
      const response = await ctx.http
        .get(`${API}/users/${created.id}`)
        .set('Authorization', bearer(actor))
        .expect(200);

      expect(response.body.registration).toBe(valid.registration);
    });

    it('responde 404 para id inexistente e 400 para id malformado', async () => {
      await ctx.http
        .get(`${API}/users/00000000-0000-4000-8000-000000000000`)
        .set('Authorization', bearer(actor))
        .expect(404);
      await ctx.http.get(`${API}/users/abc`).set('Authorization', bearer(actor)).expect(400);
    });

    it('edita parcialmente, registra a data e mantém a senha', async () => {
      const response = await ctx.http
        .patch(`${API}/users/${created.id}`)
        .set('Authorization', bearer(actor))
        .send({ name: 'Adriano Souza' })
        .expect(200);

      expect(response.body.name).toBe('Adriano Souza');
      expect(response.body.updatedAt).toEqual(expect.any(String));

      await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: valid.email, password: valid.password })
        .expect(200);
    });

    it('troca a senha quando enviada', async () => {
      await ctx.http
        .patch(`${API}/users/${created.id}`)
        .set('Authorization', bearer(actor))
        .send({ password: 'xyz789' })
        .expect(200);

      await ctx.http
        .post(`${API}/auth/login`)
        .send({ login: valid.registration, password: 'xyz789' })
        .expect(200);
    });

    it('valida as mesmas regras na edição', async () => {
      await ctx.http
        .patch(`${API}/users/${created.id}`)
        .set('Authorization', bearer(actor))
        .send({ registration: 'abc' })
        .expect(400);
    });

    it('responde 409 ao usar a matrícula de outra pessoa', async () => {
      const response = await ctx.http
        .patch(`${API}/users/${created.id}`)
        .set('Authorization', bearer(actor))
        .send({ registration: actor.registration })
        .expect(409);

      expect(response.body.field).toBe('registration');
    });

    it('exclui e depois responde 404', async () => {
      await ctx.http
        .delete(`${API}/users/${created.id}`)
        .set('Authorization', bearer(actor))
        .expect(204);
      await ctx.http
        .delete(`${API}/users/${created.id}`)
        .set('Authorization', bearer(actor))
        .expect(404);
    });
  });
});

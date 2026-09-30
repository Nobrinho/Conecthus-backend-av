import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

/**
 * Popula o banco com dados de desenvolvimento.
 *
 * Rode com `npm run db:seed`. É idempotente: usa `upsert` pela matrícula, então
 * pode ser executado quantas vezes for preciso sem duplicar usuário.
 *
 * Nunca rode isto em produção: a senha abaixo é pública.
 */
const SEED_PASSWORD = 'abc123';

/** Conta usada para entrar no sistema; é a "Millena" do protótipo. */
const DEMO_USER = {
  name: 'Millena Souza',
  email: 'millena.souza@wenlock.com',
  registration: '100001',
};

/** Nomes suficientes para preencher mais de duas páginas de 15 itens. */
const SAMPLE_NAMES = [
  'Adriano Machado Souza',
  'Raimundo Neto Abreu Teixeira',
  'Ana Beatriz Carvalho',
  'Bruno Henrique Lima',
  'Camila Rocha Andrade',
  'Daniel Ferreira Costa',
  'Eduarda Martins Pires',
  'Felipe Augusto Ramos',
  'Gabriela Nunes Barbosa',
  'Heitor Cardoso Mendes',
  'Isabela Freitas Duarte',
  'João Pedro Albuquerque',
  'Karina Moreira Batista',
  'Lucas Gabriel Monteiro',
  'Mariana Lopes Correia',
  'Natália Ribeiro Farias',
  'Otávio Castro Vieira',
  'Paula Cristina Teixeira',
  'Rafael Dias Moura',
  'Sabrina Gomes Araújo',
  'Thiago Almeida Rezende',
  'Úrsula Campos Pacheco',
  'Vinícius Barros Leal',
  'Wesley Nogueira Pinto',
  'Yasmin Cavalcanti Sá',
  'Zeca Fontes Brandão',
  'Letícia Prado Moraes',
  'Marcos Vinícius Rangel',
  'Beatriz Queiroz Tavares',
  'Caio César Siqueira',
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

/** Gera um e-mail a partir do nome, sem acentos e com no máximo 40 caracteres. */
function emailFor(name: string): string {
  const [first, ...rest] = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(' ');
  return `${first}.${rest.at(-1)}@wenlock.com`;
}

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('O seed usa uma senha conhecida e não deve rodar em produção');
  }

  const passwordHash = await argon2.hash(SEED_PASSWORD, { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { registration: DEMO_USER.registration },
    update: {},
    create: { ...DEMO_USER, passwordHash, role: Role.ADMIN },
  });

  for (const [index, name] of SAMPLE_NAMES.entries()) {
    const registration = String(200001 + index);
    await prisma.user.upsert({
      where: { registration },
      update: {},
      create: { name, email: emailFor(name), registration, passwordHash },
    });
  }

  console.log('Seed concluído.');
  console.log(`  login: ${DEMO_USER.email} (ou matrícula ${DEMO_USER.registration})`);
  console.log(`  senha: ${SEED_PASSWORD}`);
  console.log(`  + ${SAMPLE_NAMES.length} usuários de exemplo com a mesma senha`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}

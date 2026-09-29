import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient, Role, TaskStatus } from '../src/generated/prisma/client.js';

/**
 * Popula o banco com dados de desenvolvimento.
 *
 * Rode com `npm run db:seed`. É idempotente: usa `upsert` pelo email, então
 * pode ser executado quantas vezes for preciso sem duplicar usuário.
 *
 * Nunca rode isto em produção: as senhas abaixo são públicas.
 */
const SEED_PASSWORD = 'senhaSegura1';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('O seed usa senhas conhecidas e não deve rodar em produção');
  }

  const passwordHash = await argon2.hash(SEED_PASSWORD, { type: argon2.argon2id });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@exemplo.com' },
    update: {},
    create: {
      email: 'admin@exemplo.com',
      name: 'Administradora',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'ana.silva@exemplo.com' },
    update: {},
    create: {
      email: 'ana.silva@exemplo.com',
      name: 'Ana Silva',
      passwordHash,
      role: Role.USER,
    },
  });

  await prisma.task.deleteMany({ where: { ownerId: { in: [admin.id, member.id] } } });
  await prisma.task.createMany({
    data: [
      {
        title: 'Configurar o ambiente local',
        description: 'Subir o Postgres, aplicar as migrations e rodar o seed.',
        status: TaskStatus.DONE,
        ownerId: member.id,
      },
      {
        title: 'Escrever a documentação da API',
        description: 'Revisar as descrições que aparecem no Swagger.',
        status: TaskStatus.IN_PROGRESS,
        ownerId: member.id,
      },
      {
        title: 'Publicar a primeira versão',
        status: TaskStatus.TODO,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ownerId: member.id,
      },
      {
        title: 'Revisar os papéis de acesso',
        description: 'Conferir quais rotas exigem ADMIN.',
        status: TaskStatus.TODO,
        ownerId: admin.id,
      },
    ],
  });

  console.log('Seed concluído.');
  console.log(`  admin: ${admin.email} / ${SEED_PASSWORD}`);
  console.log(`  usuária comum: ${member.email} / ${SEED_PASSWORD}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}

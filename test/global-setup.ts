import { execSync } from 'node:child_process';
import { config } from 'dotenv';

/**
 * Roda uma vez, antes de todas as suítes e2e.
 *
 * Aplica as migrations no banco de teste (o serviço `db-test` do
 * docker-compose, na porta 5433). Sem isso, um esquema desatualizado faria as
 * suítes falharem com erros de coluna inexistente em vez de erros de regra.
 */
export default function setup(): void {
  const parsed = config({ path: '.env.test' }).parsed;

  if (!parsed?.['DATABASE_URL']) {
    throw new Error('.env.test precisa definir DATABASE_URL');
  }

  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: parsed['DATABASE_URL'] },
    });
  } catch {
    throw new Error(
      'Não foi possível aplicar as migrations no banco de teste.\n' +
        'Suba o container com: docker compose up -d db-test',
    );
  }
}

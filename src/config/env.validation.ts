import { z } from 'zod';

const MIN_SECRET_LENGTH = 32;

/**
 * Contrato das variáveis de ambiente. Este arquivo é a única fonte de verdade
 * sobre o que a aplicação precisa para subir: se algo aqui não for satisfeito,
 * o processo falha no boot com uma mensagem apontando o campo faltante, em vez
 * de quebrar no meio de uma requisição.
 *
 * Ao adicionar uma variável nova, adicione também no `.env.example`.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    API_PREFIX: z.string().min(1).default('api'),
    CORS_ORIGINS: z.string().default('*'),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z
      .string()
      .min(1, 'obrigatória: string de conexão do Postgres')
      .refine((url) => url.startsWith('postgres://') || url.startsWith('postgresql://'), {
        message: 'deve começar com postgres:// ou postgresql://',
      }),

    JWT_ACCESS_SECRET: z
      .string()
      .min(MIN_SECRET_LENGTH, `precisa de pelo menos ${MIN_SECRET_LENGTH} caracteres`),
    JWT_ACCESS_TTL: z.string().min(1).default('15m'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(MIN_SECRET_LENGTH, `precisa de pelo menos ${MIN_SECRET_LENGTH} caracteres`),
    JWT_REFRESH_TTL: z.string().min(1).default('7d'),

    THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
    THROTTLE_CREDENTIALS_TTL: z.coerce.number().int().positive().default(60_000),
    THROTTLE_CREDENTIALS_LIMIT: z.coerce.number().int().positive().default(10),

    /** URL pública do frontend, usada para montar o link de redefinição de senha. */
    APP_URL: z.url().default('http://localhost:3001'),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

    /** Sem SMTP_HOST os e-mails são apenas registrados no log (útil em dev e testes). */
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().max(65535).default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().min(1).default('WenLock <nao-responda@wenlock.local>'),

    SWAGGER_ENABLED: z.stringbool().default(true),
    SWAGGER_PATH: z.string().min(1).default('docs'),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message:
          'deve ser diferente de JWT_ACCESS_SECRET, senão um access token vale como refresh token',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Valida `process.env` e devolve o objeto já tipado e com defaults aplicados.
 * Lança um erro legível listando todos os problemas de uma vez.
 */
export function validateEnv(source: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Variáveis de ambiente inválidas:\n${details}\n\nCompare o seu .env com o .env.example.`,
    );
  }

  return result.data;
}

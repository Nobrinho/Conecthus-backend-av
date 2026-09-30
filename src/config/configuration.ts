import { validateEnv } from './env.validation.js';

/**
 * Forma da configuração da aplicação. Injete com
 * `ConfigService<AppConfig, true>` e leia com
 * `config.get('jwt.accessSecret', { infer: true })` para ter tipagem completa.
 */
export interface AppConfig {
  app: {
    env: 'development' | 'test' | 'production';
    isProduction: boolean;
    port: number;
    prefix: string;
    /** `true` libera qualquer origem; caso contrario, lista explicita. */
    corsOrigins: true | string[];
    logLevel: string;
  };
  database: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  throttle: {
    ttl: number;
    limit: number;
    /** Janela e limite das rotas marcadas com `CredentialRateLimit`. */
    credentialsTtl: number;
    credentialsLimit: number;
  };
  swagger: {
    enabled: boolean;
    path: string;
  };
  passwordReset: {
    /** Endereço do frontend onde fica a tela de redefinição de senha. */
    appUrl: string;
    ttlMinutes: number;
  };
  mail: {
    /** `null` desliga o envio real: o conteúdo do e-mail vai para o log. */
    host: string | null;
    port: number;
    user: string | null;
    password: string | null;
    from: string;
  };
}

export const configuration = (): AppConfig => {
  const env = validateEnv();
  const origins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    app: {
      env: env.NODE_ENV,
      isProduction: env.NODE_ENV === 'production',
      port: env.PORT,
      prefix: env.API_PREFIX,
      corsOrigins: origins.includes('*') ? true : origins,
      logLevel: env.LOG_LEVEL,
    },
    database: {
      url: env.DATABASE_URL,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshSecret: env.JWT_REFRESH_SECRET,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
      credentialsTtl: env.THROTTLE_CREDENTIALS_TTL,
      credentialsLimit: env.THROTTLE_CREDENTIALS_LIMIT,
    },
    swagger: {
      enabled: env.SWAGGER_ENABLED,
      path: env.SWAGGER_PATH,
    },
    passwordReset: {
      appUrl: env.APP_URL.replace(/\/$/, ''),
      ttlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
    },
    mail: {
      host: env.SMTP_HOST || null,
      port: env.SMTP_PORT,
      user: env.SMTP_USER || null,
      password: env.SMTP_PASSWORD || null,
      from: env.MAIL_FROM,
    },
  };
};

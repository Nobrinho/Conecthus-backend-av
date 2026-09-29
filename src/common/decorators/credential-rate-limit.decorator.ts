import { SetMetadata } from '@nestjs/common';

export const CREDENTIAL_ROUTE_KEY = 'credentialRoute';
export const CREDENTIALS_THROTTLER = 'credentials';

/**
 * Submete a rota ao limitador estrito, além do limite geral da API.
 *
 * Use nas rotas que recebem credenciais: login, cadastro e renovação de token.
 * Elas são o alvo natural de força bruta e merecem uma janela bem mais curta
 * que a de um GET qualquer.
 *
 * O limitador `credentials` é configurado em `AppModule` com um `skipIf` que
 * procura por esta marcação, então uma rota sem o decorator simplesmente não é
 * afetada: esquecer de aplicá-lo afrouxa um limite, nunca aperta outro por
 * engano.
 */
export const CredentialRateLimit = () => SetMetadata(CREDENTIAL_ROUTE_KEY, true);

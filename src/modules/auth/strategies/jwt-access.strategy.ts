import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from '../../../config/configuration.js';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../../../common/types/authenticated-user.js';
import { UsersService } from '../../users/users.service.js';

export const JWT_ACCESS_STRATEGY = 'jwt-access';

/**
 * Valida o access token enviado em `Authorization: Bearer <token>`.
 *
 * O retorno de `validate` vira o `request.user` lido pelo decorator
 * `CurrentUser` e pelo `RolesGuard`.
 *
 * A estratégia consulta o banco a cada requisição, e isso é deliberado: sem a
 * consulta, um usuário desativado continuaria entrando até o token expirar.
 * Se o custo pesar, troque por um cache curto em vez de remover a checagem.
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, JWT_ACCESS_STRATEGY) {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.accessSecret', { infer: true }),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findEntityById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sessão inválida ou conta desativada');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}

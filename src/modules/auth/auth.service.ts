import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from '../../config/configuration.js';
import { HashService } from '../../infra/hash/hash.service.js';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../../common/types/authenticated-user.js';
import type { User } from '../../infra/prisma/prisma.client.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { UsersService } from '../users/users.service.js';
import type { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { RefreshTokensRepository } from './refresh-tokens.repository.js';

/** Dados mínimos necessários para assinar um par de tokens. */
type TokenSubject = Pick<User, 'id' | 'email' | 'role'>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Hash descartável usado para igualar o tempo de resposta do login. */
  private dummyPasswordHash: string | null = null;

  constructor(
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly hash: HashService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    if (await this.users.findEntityByEmail(dto.email)) {
      throw new ConflictException('Já existe uma conta com este email');
    }

    const user = await this.users.create(dto);

    return { user, tokens: await this.issueTokens(user) };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findEntityByEmail(dto.email);

    if (!user) {
      // Verifica contra um hash falso para que um email inexistente leve o
      // mesmo tempo de um email real com senha errada. Sem isso, o tempo de
      // resposta revela quais emails estão cadastrados.
      await this.verifyAgainstDummyHash(dto.password);
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    if (!(await this.hash.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Esta conta está desativada');
    }

    return {
      user: UserResponseDto.fromEntity(user),
      tokens: await this.issueTokens(user),
    };
  }

  /**
   * Troca um refresh token válido por um par novo e invalida o antigo.
   *
   * A rotação é o que limita o estrago de um token vazado: ele só serve uma
   * vez. Se um token já usado reaparecer, a hipótese mais provável é roubo,
   * então todas as sessões daquele usuário são encerradas.
   */
  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const stored = await this.refreshTokens.findById(payload.jti);

    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Sessão inválida');
    }

    if (stored.revokedAt !== null) {
      this.logger.warn(
        `Reuso de refresh token detectado para o usuário ${stored.userId}; encerrando todas as sessões`,
      );
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException(
        'Este refresh token já foi utilizado. Todas as sessões foram encerradas, faça login novamente.',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sessão expirada, faça login novamente');
    }

    if (stored.tokenHash !== this.hash.hashToken(refreshToken)) {
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Sessão inválida');
    }

    const user = await this.users.findEntityById(stored.userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Esta conta está desativada');
    }

    await this.refreshTokens.revoke(stored.id);

    return {
      user: UserResponseDto.fromEntity(user),
      tokens: await this.issueTokens(user),
    };
  }

  /**
   * Encerra a sessão associada ao refresh token informado.
   * Nunca falha: um logout com token inválido já atingiu o objetivo.
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      const stored = await this.refreshTokens.findById(payload.jti);

      if (stored && stored.revokedAt === null) {
        await this.refreshTokens.revoke(stored.id);
      }
    } catch {
      this.logger.debug('Logout recebeu um refresh token inválido; ignorando');
    }
  }

  /** Encerra todas as sessões do usuário autenticado. */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
  }

  async me(userId: string): Promise<UserResponseDto> {
    const user = await this.users.findEntityById(userId);

    if (!user) {
      throw new UnauthorizedException('Sessão inválida');
    }

    return UserResponseDto.fromEntity(user);
  }

  private async issueTokens(user: TokenSubject): Promise<AuthTokensDto> {
    const jti = randomUUID();

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get('jwt.accessSecret', { infer: true }),
      expiresIn: this.config.get('jwt.accessTtl', { infer: true }),
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get('jwt.refreshSecret', { infer: true }),
      expiresIn: this.config.get('jwt.refreshTtl', { infer: true }),
    });

    // O token em si nunca é persistido, apenas o hash; a linha é endereçada
    // pelo `jti` que viaja dentro do próprio JWT.
    await this.refreshTokens.create({
      id: jti,
      userId: user.id,
      tokenHash: this.hash.hashToken(refreshToken),
      expiresAt: new Date(this.expirationOf(refreshToken) * 1000),
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: Math.max(0, this.expirationOf(accessToken) - Math.floor(Date.now() / 1000)),
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  private expirationOf(token: string): number {
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    return decoded?.exp ?? 0;
  }

  private async verifyAgainstDummyHash(password: string): Promise<void> {
    this.dummyPasswordHash ??= await this.hash.hash('conta-inexistente-apenas-para-igualar-tempo');
    await this.hash.verify(this.dummyPasswordHash, password);
  }
}

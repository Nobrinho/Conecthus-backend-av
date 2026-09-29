import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/configuration.js';
import type { HashService } from '../../infra/hash/hash.service.js';
import { Role, type RefreshToken, type User } from '../../infra/prisma/prisma.client.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type { RefreshTokensRepository } from './refresh-tokens.repository.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'ana@exemplo.com',
  name: 'Ana',
  passwordHash: 'hash-da-senha',
  role: Role.USER,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildStoredToken = (overrides: Partial<RefreshToken> = {}): RefreshToken => ({
  id: 'jti-1',
  tokenHash: 'hash-do-token',
  userId: 'user-1',
  expiresAt: new Date(Date.now() + ONE_HOUR_MS),
  revokedAt: null,
  createdAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let refreshTokens: Record<string, ReturnType<typeof vi.fn>>;
  let hash: Record<string, ReturnType<typeof vi.fn>>;
  let jwt: Record<string, ReturnType<typeof vi.fn>>;
  let service: AuthService;

  beforeEach(() => {
    users = {
      findEntityByEmail: vi.fn().mockResolvedValue(null),
      findEntityById: vi.fn().mockResolvedValue(buildUser()),
      create: vi.fn(),
    };
    refreshTokens = {
      create: vi.fn().mockResolvedValue(buildStoredToken()),
      findById: vi.fn(),
      revoke: vi.fn().mockResolvedValue(undefined),
      revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    hash = {
      hash: vi.fn().mockResolvedValue('hash-da-senha'),
      verify: vi.fn().mockResolvedValue(true),
      hashToken: vi.fn().mockReturnValue('hash-do-token'),
    };
    jwt = {
      signAsync: vi.fn().mockResolvedValue('token-assinado'),
      verifyAsync: vi.fn(),
      decode: vi.fn().mockReturnValue({ exp: Math.floor((Date.now() + ONE_HOUR_MS) / 1000) }),
    };

    const config = {
      get: vi.fn((key: string) => `valor-de-${key}`),
    } as unknown as ConfigService<AppConfig, true>;

    service = new AuthService(
      users as unknown as UsersService,
      refreshTokens as unknown as RefreshTokensRepository,
      hash as unknown as HashService,
      jwt as unknown as JwtService,
      config,
    );
  });

  describe('register', () => {
    it('recusa email já cadastrado', async () => {
      users['findEntityByEmail']!.mockResolvedValue(buildUser());

      await expect(
        service.register({ email: 'ana@exemplo.com', name: 'Ana', password: 'senhaSegura1' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(users['create']).not.toHaveBeenCalled();
    });

    it('persiste o hash do refresh token, nunca o token em si', async () => {
      users['create']!.mockResolvedValue({
        id: 'user-1',
        email: 'ana@exemplo.com',
        role: Role.USER,
      });

      const result = await service.register({
        email: 'ana@exemplo.com',
        name: 'Ana',
        password: 'senhaSegura1',
      });

      expect(result.tokens.tokenType).toBe('Bearer');
      expect(refreshTokens['create']).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: 'hash-do-token', userId: 'user-1' }),
      );
      const persisted = refreshTokens['create']!.mock.calls[0][0];
      expect(persisted.tokenHash).not.toBe(result.tokens.refreshToken);
    });
  });

  describe('login', () => {
    it('recusa email inexistente sem revelar que a conta não existe', async () => {
      users['findEntityByEmail']!.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ninguem@exemplo.com', password: 'senhaSegura1' }),
      ).rejects.toThrowError(new UnauthorizedException('Email ou senha inválidos').message);

      // Mesmo sem usuário, um hash é verificado para igualar o tempo de resposta.
      expect(hash['verify']).toHaveBeenCalled();
    });

    it('recusa senha errada', async () => {
      users['findEntityByEmail']!.mockResolvedValue(buildUser());
      hash['verify']!.mockResolvedValue(false);

      await expect(
        service.login({ email: 'ana@exemplo.com', password: 'errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('recusa conta desativada mesmo com a senha correta', async () => {
      users['findEntityByEmail']!.mockResolvedValue(buildUser({ isActive: false }));

      await expect(
        service.login({ email: 'ana@exemplo.com', password: 'senhaSegura1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('emite tokens quando as credenciais conferem', async () => {
      users['findEntityByEmail']!.mockResolvedValue(buildUser());

      const result = await service.login({ email: 'ana@exemplo.com', password: 'senhaSegura1' });

      expect(result.user.email).toBe('ana@exemplo.com');
      expect(result.tokens.accessToken).toBe('token-assinado');
    });
  });

  describe('refresh', () => {
    beforeEach(() => {
      jwt['verifyAsync']!.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
    });

    it('revoga o token apresentado e emite um par novo', async () => {
      refreshTokens['findById']!.mockResolvedValue(buildStoredToken());

      await service.refresh('refresh-valido');

      expect(refreshTokens['revoke']).toHaveBeenCalledWith('jti-1');
      expect(refreshTokens['create']).toHaveBeenCalled();
    });

    it('encerra todas as sessões quando um token revogado é reapresentado', async () => {
      refreshTokens['findById']!.mockResolvedValue(buildStoredToken({ revokedAt: new Date() }));

      await expect(service.refresh('refresh-reusado')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens['revokeAllForUser']).toHaveBeenCalledWith('user-1');
    });

    it('encerra todas as sessões quando o hash não confere', async () => {
      refreshTokens['findById']!.mockResolvedValue(buildStoredToken({ tokenHash: 'outro-hash' }));

      await expect(service.refresh('refresh-adulterado')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens['revokeAllForUser']).toHaveBeenCalledWith('user-1');
    });

    it('recusa token vencido', async () => {
      refreshTokens['findById']!.mockResolvedValue(
        buildStoredToken({ expiresAt: new Date(Date.now() - ONE_HOUR_MS) }),
      );

      await expect(service.refresh('refresh-vencido')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens['revoke']).not.toHaveBeenCalled();
    });

    it('recusa token cuja linha pertence a outro usuário', async () => {
      refreshTokens['findById']!.mockResolvedValue(buildStoredToken({ userId: 'outro-usuario' }));

      await expect(service.refresh('refresh-trocado')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('recusa quando a conta foi desativada depois do login', async () => {
      refreshTokens['findById']!.mockResolvedValue(buildStoredToken());
      users['findEntityById']!.mockResolvedValue(buildUser({ isActive: false }));

      await expect(service.refresh('refresh-valido')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('recusa assinatura inválida', async () => {
      jwt['verifyAsync']!.mockRejectedValue(new Error('invalid signature'));

      await expect(service.refresh('não-e-um-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revoga a sessão do token apresentado', async () => {
      jwt['verifyAsync']!.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      refreshTokens['findById']!.mockResolvedValue(buildStoredToken());

      await service.logout('refresh-valido');

      expect(refreshTokens['revoke']).toHaveBeenCalledWith('jti-1');
    });

    it('não falha com token inválido', async () => {
      jwt['verifyAsync']!.mockRejectedValue(new Error('invalid signature'));

      await expect(service.logout('lixo')).resolves.toBeUndefined();
    });
  });
});

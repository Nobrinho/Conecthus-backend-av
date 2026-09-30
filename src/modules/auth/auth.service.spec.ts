import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/configuration.js';
import type { HashService } from '../../infra/hash/hash.service.js';
import type { MailService } from '../../infra/mail/mail.service.js';
import {
  Role,
  type PasswordResetToken,
  type RefreshToken,
  type User,
} from '../../infra/prisma/prisma.client.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService, INVALID_CREDENTIALS } from './auth.service.js';
import type { PasswordResetTokensRepository } from './password-reset-tokens.repository.js';
import type { RefreshTokensRepository } from './refresh-tokens.repository.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'ana@exemplo.com',
  name: 'Ana',
  registration: '809987',
  passwordHash: 'hash-da-senha',
  role: Role.USER,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: null,
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

const buildResetToken = (overrides: Partial<PasswordResetToken> = {}): PasswordResetToken => ({
  id: 'reset-1',
  tokenHash: 'hash-do-token',
  userId: 'user-1',
  expiresAt: new Date(Date.now() + ONE_HOUR_MS),
  usedAt: null,
  createdAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let refreshTokens: Record<string, ReturnType<typeof vi.fn>>;
  let resetTokens: Record<string, ReturnType<typeof vi.fn>>;
  let mail: Record<string, ReturnType<typeof vi.fn>>;
  let hash: Record<string, ReturnType<typeof vi.fn>>;
  let jwt: Record<string, ReturnType<typeof vi.fn>>;
  let service: AuthService;

  beforeEach(() => {
    users = {
      findEntityByEmail: vi.fn().mockResolvedValue(null),
      findEntityByRegistration: vi.fn().mockResolvedValue(null),
      findEntityById: vi.fn().mockResolvedValue(buildUser()),
      updatePassword: vi.fn().mockResolvedValue(undefined),
    };
    resetTokens = {
      create: vi.fn().mockResolvedValue(buildResetToken()),
      findByHash: vi.fn(),
      invalidatePendingForUser: vi.fn().mockResolvedValue({ count: 0 }),
      markUsed: vi.fn().mockResolvedValue(buildResetToken({ usedAt: new Date() })),
    };
    mail = { send: vi.fn().mockResolvedValue(undefined) };
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

    const values: Record<string, unknown> = {
      'passwordReset.ttlMinutes': 30,
      'passwordReset.appUrl': 'http://app.local',
    };
    const config = {
      get: vi.fn((key: string) => values[key] ?? `valor-de-${key}`),
    } as unknown as ConfigService<AppConfig, true>;

    service = new AuthService(
      users as unknown as UsersService,
      refreshTokens as unknown as RefreshTokensRepository,
      resetTokens as unknown as PasswordResetTokensRepository,
      hash as unknown as HashService,
      mail as unknown as MailService,
      jwt as unknown as JwtService,
      config,
    );
  });

  describe('login', () => {
    it('recusa usuário inexistente com a mesma mensagem de senha errada', async () => {
      users['findEntityByEmail']!.mockResolvedValue(null);

      await expect(
        service.login({ login: 'ninguem@exemplo.com', password: 'abc123' }),
      ).rejects.toThrowError(INVALID_CREDENTIALS);

      // Mesmo sem usuário, um hash é verificado para igualar o tempo de resposta.
      expect(hash['verify']).toHaveBeenCalled();
    });

    it('recusa senha errada', async () => {
      users['findEntityByEmail']!.mockResolvedValue(buildUser());
      hash['verify']!.mockResolvedValue(false);

      await expect(
        service.login({ login: 'ana@exemplo.com', password: 'errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('recusa conta desativada mesmo com a senha correta', async () => {
      users['findEntityByEmail']!.mockResolvedValue(buildUser({ isActive: false }));

      await expect(
        service.login({ login: 'ana@exemplo.com', password: 'abc123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('emite tokens quando as credenciais conferem', async () => {
      users['findEntityByEmail']!.mockResolvedValue(buildUser());

      const result = await service.login({ login: 'ana@exemplo.com', password: 'abc123' });

      expect(result.user.email).toBe('ana@exemplo.com');
      expect(result.tokens.accessToken).toBe('token-assinado');
    });

    it('aceita a matrícula no lugar do e-mail', async () => {
      users['findEntityByRegistration']!.mockResolvedValue(buildUser());

      const result = await service.login({ login: '809987', password: 'abc123' });

      expect(users['findEntityByRegistration']).toHaveBeenCalledWith('809987');
      expect(users['findEntityByEmail']).not.toHaveBeenCalled();
      expect(result.user.registration).toBe('809987');
    });

    it('persiste o hash do refresh token, nunca o token em si', async () => {
      users['findEntityByEmail']!.mockResolvedValue(buildUser());

      const result = await service.login({ login: 'ana@exemplo.com', password: 'abc123' });

      const persisted = refreshTokens['create']!.mock.calls[0]![0];
      expect(persisted.tokenHash).toBe('hash-do-token');
      expect(persisted.tokenHash).not.toBe(result.tokens.refreshToken);
    });
  });

  describe('forgotPassword', () => {
    it('responde 404 quando o e-mail não está cadastrado', async () => {
      await expect(service.forgotPassword({ email: 'ninguem@exemplo.com' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mail['send']).not.toHaveBeenCalled();
    });

    it('guarda só o hash do token e envia o link por e-mail', async () => {
      users['findEntityByEmail']!.mockResolvedValue(buildUser());

      await service.forgotPassword({ email: 'ana@exemplo.com' });

      expect(resetTokens['invalidatePendingForUser']).toHaveBeenCalledWith('user-1');
      expect(resetTokens['create']).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', tokenHash: 'hash-do-token' }),
      );
      const message = mail['send']!.mock.calls[0]![0];
      expect(message.to).toBe('ana@exemplo.com');
      expect(message.text).toMatch(/http:\/\/app\.local\/redefinir-senha\?token=[\w-]+/);
    });
  });

  describe('resetPassword', () => {
    it('troca a senha, consome o token e encerra as sessões', async () => {
      resetTokens['findByHash']!.mockResolvedValue(buildResetToken());

      await service.resetPassword({ token: 'token', password: 'xyz789' });

      expect(resetTokens['markUsed']).toHaveBeenCalledWith('reset-1');
      expect(users['updatePassword']).toHaveBeenCalledWith('user-1', 'xyz789');
      expect(refreshTokens['revokeAllForUser']).toHaveBeenCalledWith('user-1');
    });

    it.each([
      ['inexistente', null],
      ['já usado', buildResetToken({ usedAt: new Date() })],
      ['vencido', buildResetToken({ expiresAt: new Date(Date.now() - 1000) })],
    ])('recusa token %s', async (_, stored) => {
      resetTokens['findByHash']!.mockResolvedValue(stored);

      await expect(
        service.resetPassword({ token: 'token', password: 'xyz789' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users['updatePassword']).not.toHaveBeenCalled();
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

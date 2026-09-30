import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordResetTokensRepository } from './password-reset-tokens.repository.js';
import { RefreshTokensRepository } from './refresh-tokens.repository.js';
import { JWT_ACCESS_STRATEGY, JwtAccessStrategy } from './strategies/jwt-access.strategy.js';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: JWT_ACCESS_STRATEGY, session: false }),
    // Sem segredo global de propósito: access e refresh usam segredos
    // diferentes, informados na hora de assinar e de verificar.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokensRepository,
    PasswordResetTokensRepository,
    JwtAccessStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}

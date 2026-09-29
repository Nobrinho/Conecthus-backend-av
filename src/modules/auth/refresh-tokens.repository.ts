import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { RefreshToken } from '../../infra/prisma/prisma.client.js';

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findById(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { id } });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** Encerra todas as sessões ativas do usuário de uma vez. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Limpeza de tokens vencidos. Chame de uma rotina agendada se o volume crescer. */
  async deleteExpired(): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return count;
  }
}

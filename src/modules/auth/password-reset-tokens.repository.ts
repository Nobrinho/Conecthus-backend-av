import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { PasswordResetToken, Prisma } from '../../infra/prisma/prisma.client.js';

@Injectable()
export class PasswordResetTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.PasswordResetTokenUncheckedCreateInput): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  /** Invalida os links pendentes, para que só o mais recente funcione. */
  invalidatePendingForUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  markUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }
}

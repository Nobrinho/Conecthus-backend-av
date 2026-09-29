import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/**
 * Concentra as primitivas de hash da aplicação.
 *
 * Isolar aqui tem dois motivos: trocar o algoritmo de senha vira uma mudança de
 * um arquivo só, e a escolha do algoritmo fica explícita em um lugar onde dá
 * para justificá-la.
 */
@Injectable()
export class HashService {
  /**
   * Hash de senha com argon2id, que é lento de propósito para encarecer um
   * ataque de força bruta contra senhas escolhidas por pessoas.
   */
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Hash corrompido ou em formato desconhecido: trate como senha inválida.
      return false;
    }
  }

  /**
   * Hash de refresh token com SHA-256.
   *
   * Aqui o argon2 seria desperdício: o token é gerado pelo servidor e já tem
   * entropia alta, então não existe dicionário a ser testado. O que importa é
   * que um vazamento da tabela não entregue tokens utilizáveis, e um hash
   * rápido resolve isso sem somar latência a cada renovação de sessão.
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

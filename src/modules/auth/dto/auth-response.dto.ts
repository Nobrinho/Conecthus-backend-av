import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class AuthTokensDto {
  /** Token de acesso. Envie no header `Authorization: Bearer <token>`. */
  accessToken!: string;

  /** Token de renovação. Guarde com o mesmo cuidado de uma senha. */
  refreshToken!: string;

  /** Sempre `Bearer`. */
  tokenType!: string;

  /** Segundos restantes até o access token expirar. */
  expiresIn!: number;
}

export class AuthResponseDto {
  user!: UserResponseDto;
  tokens!: AuthTokensDto;
}

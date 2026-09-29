import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CredentialRateLimit } from '../../common/decorators/credential-rate-limit.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { AuthService } from './auth.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @CredentialRateLimit()
  @ApiOperation({
    summary: 'Cria uma conta e já devolve os tokens',
    description: 'O papel é sempre USER. Criar administradores é feito por POST /users.',
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email já cadastrado' })
  @ApiTooManyRequestsResponse({ description: 'Limite de tentativas excedido' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @CredentialRateLimit()
  @ApiOperation({ summary: 'Autentica e devolve o par de tokens' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas ou conta desativada' })
  @ApiTooManyRequestsResponse({ description: 'Limite de tentativas excedido' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @CredentialRateLimit()
  @ApiOperation({
    summary: 'Renova a sessão',
    description:
      'Invalida o refresh token enviado e devolve um par novo. Reapresentar um token já usado encerra todas as sessões da conta.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token inválido, expirado ou já utilizado' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Encerra a sessão do refresh token informado',
    description: 'Idempotente: responde 204 mesmo se o token já estiver inválido.',
  })
  @ApiNoContentResponse({ description: 'Sessão encerrada' })
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerra todas as sessões do usuário autenticado' })
  @ApiNoContentResponse({ description: 'Sessões encerradas' })
  logoutAll(@CurrentUser('id') userId: string): Promise<void> {
    return this.authService.logoutAll(userId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, expirado ou inválido' })
  me(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    return this.authService.me(userId);
  }
}

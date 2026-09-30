import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CredentialRateLimit } from '../../common/decorators/credential-rate-limit.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { AuthService } from './auth.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @CredentialRateLimit()
  @ApiOperation({
    summary: 'Autentica e devolve o par de tokens',
    description: 'O campo `login` aceita o e-mail ou a matrícula.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Usuário/Senha inválido(a) ou conta desativada',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Limite de tentativas excedido' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CredentialRateLimit()
  @ApiOperation({
    summary: 'Envia o link de recuperação de senha',
    description: 'O link leva à tela de redefinição do frontend e vale por tempo limitado.',
  })
  @ApiNoContentResponse({ description: 'E-mail enviado' })
  @ApiNotFoundResponse({ description: 'E-mail não cadastrado', type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Limite de tentativas excedido' })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CredentialRateLimit()
  @ApiOperation({
    summary: 'Define uma nova senha a partir do link de recuperação',
    description: 'O link é de uso único. Todas as sessões abertas da conta são encerradas.',
  })
  @ApiNoContentResponse({ description: 'Senha redefinida' })
  @ApiBadRequestResponse({
    description: 'Link inválido/expirado ou senha fora da regra',
    type: ErrorResponseDto,
  })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
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

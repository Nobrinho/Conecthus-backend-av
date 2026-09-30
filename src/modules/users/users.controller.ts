import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator.js';
import type { PaginatedDto } from '../../common/dto/paginated-result.dto.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

/**
 * CRUD de usuários. Todas as rotas exigem um access token válido: o sistema é
 * de gestão interna e qualquer pessoa autenticada pode administrar cadastros,
 * como no protótipo, que não diferencia perfis.
 */
@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token ausente, expirado ou inválido',
  type: ErrorResponseDto,
})
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um usuário' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({
    description: 'Algum campo não atende às regras',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'E-mail ou matrícula já cadastrados. O campo `field` indica qual.',
    type: ErrorResponseDto,
  })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista usuários com paginação e busca por nome',
    description: 'Ordenada por nome. 15 itens por página por padrão, como no protótipo.',
  })
  @ApiPaginatedResponse(UserResponseDto)
  findAll(@Query() query: QueryUsersDto): Promise<PaginatedDto<UserResponseDto>> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um usuário pelo id' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Usuário inexistente', type: ErrorResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza um usuário',
    description: 'Envie apenas os campos alterados. Sem `password`, a senha atual é mantida.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({
    description: 'Algum campo não atende às regras',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Usuário inexistente', type: ErrorResponseDto })
  @ApiConflictResponse({
    description: 'E-mail ou matrícula já cadastrados',
    type: ErrorResponseDto,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove um usuário',
    description: 'As sessões do usuário são encerradas em cascata.',
  })
  @ApiNoContentResponse({ description: 'Usuário removido' })
  @ApiNotFoundResponse({ description: 'Usuário inexistente', type: ErrorResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}

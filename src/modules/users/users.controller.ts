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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { PaginatedDto } from '../../common/dto/paginated-result.dto.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { Role } from '../../infra/prisma/prisma.client.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Cria um usuário',
    description:
      'Restrito a administradores. Para autocadastro use POST /auth/register, que não permite escolher o papel.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'Já existe um usuário com este email' })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lista usuários com paginação e filtros' })
  @ApiPaginatedResponse(UserResponseDto)
  findAll(@Query() query: QueryUsersDto): Promise<PaginatedDto<UserResponseDto>> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Busca um usuário pelo id',
    description: 'Um usuário comum só consegue ler o próprio cadastro.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Tentativa de ler o cadastro de outro usuário' })
  @ApiNotFoundResponse({ description: 'Usuário inexistente' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(id, actor);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza um usuário',
    description: 'Alterar `role` ou `isActive` exige papel ADMIN.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão para alterar este usuário ou estes campos' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto, actor);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Troca a própria senha',
    description: 'Exige a senha atual mesmo com a sessão autenticada.',
  })
  @ApiNoContentResponse({ description: 'Senha alterada' })
  @ApiForbiddenResponse({
    description: 'Senha atual incorreta ou usuário diferente do autenticado',
  })
  changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.usersService.changePassword(id, dto, actor);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove um usuário',
    description: 'As tarefas e os refresh tokens do usuário são removidos em cascata.',
  })
  @ApiNoContentResponse({ description: 'Usuário removido' })
  @ApiNotFoundResponse({ description: 'Usuário inexistente' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}

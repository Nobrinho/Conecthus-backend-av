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
import type { PaginatedDto } from '../../common/dto/paginated-result.dto.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { TaskResponseDto } from './dto/task-response.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller({ path: 'tasks', version: '1' })
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({
    summary: 'Cria uma tarefa',
    description: 'A tarefa nasce pertencendo ao usuário autenticado.',
  })
  @ApiCreatedResponse({ type: TaskResponseDto })
  create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.tasksService.create(dto, actor);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista tarefas com paginação, busca e filtro por status',
    description:
      'Um usuário comum vê apenas as próprias tarefas. Administradores veem todas e podem filtrar por `ownerId`.',
  })
  @ApiPaginatedResponse(TaskResponseDto)
  findAll(
    @Query() query: QueryTasksDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PaginatedDto<TaskResponseDto>> {
    return this.tasksService.findAll(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma tarefa pelo id' })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiForbiddenResponse({ description: 'A tarefa pertence a outro usuário' })
  @ApiNotFoundResponse({ description: 'Tarefa inexistente' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.tasksService.findOne(id, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza os campos informados de uma tarefa' })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiForbiddenResponse({ description: 'A tarefa pertence a outro usuário' })
  @ApiNotFoundResponse({ description: 'Tarefa inexistente' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.tasksService.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma tarefa' })
  @ApiNoContentResponse({ description: 'Tarefa removida' })
  @ApiForbiddenResponse({ description: 'A tarefa pertence a outro usuário' })
  @ApiNotFoundResponse({ description: 'Tarefa inexistente' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.tasksService.remove(id, actor);
  }
}

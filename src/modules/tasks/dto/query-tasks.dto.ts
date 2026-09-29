import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { TaskStatus } from '../../../infra/prisma/prisma.client.js';

export class QueryTasksDto extends PaginationQueryDto {
  /** Busca parcial no título, sem diferenciar maiúsculas. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiProperty({ required: false, example: 'documentação' })
  search?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus', required: false })
  status?: TaskStatus;

  /** Filtra por dono. Ignorado para usuários comuns, que só veem as próprias. */
  @IsOptional()
  @IsUUID()
  @ApiProperty({ required: false, description: 'Apenas administradores podem usar este filtro' })
  ownerId?: string;
}

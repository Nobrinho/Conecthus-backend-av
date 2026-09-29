import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { TaskStatus } from '../../../infra/prisma/prisma.client.js';

export class CreateTaskDto {
  @IsString()
  @Length(1, 200)
  @ApiProperty({ example: 'Escrever a documentação da API' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ApiProperty({ required: false, example: 'Cobrir os endpoints de autenticação.' })
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  @ApiProperty({
    enum: TaskStatus,
    enumName: 'TaskStatus',
    required: false,
    default: TaskStatus.TODO,
  })
  status?: TaskStatus;

  /** Prazo em ISO 8601, por exemplo `2026-12-31T23:59:00.000Z`. */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'dueDate precisa ser uma data ISO 8601 válida' })
  @ApiProperty({ required: false, type: String, format: 'date-time' })
  dueDate?: Date;
}

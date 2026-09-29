import { PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto.js';

/** Todos os campos opcionais: o PATCH altera só o que vier no corpo. */
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

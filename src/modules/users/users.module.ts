import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  // Exportado porque o AuthModule reaproveita as regras de usuário no login.
  exports: [UsersService],
})
export class UsersModule {}

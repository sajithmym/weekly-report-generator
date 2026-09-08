import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserRoleDto, UpdateUserStatusDto, UserFilterDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/enums';
import { ApiResponse } from '../common/dto';
import { RequestWithUser } from '../common/interfaces';
import { API_RESPONSE_MESSAGES, USER_SETTINGS } from '../settings';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findAll(@Query() filters: UserFilterDto) {
    try {
      const result = await this.usersService.findAll(filters);
      return ApiResponse.paginated(result.data, result.meta, API_RESPONSE_MESSAGES.users.fetched);
    } catch (error) {
      // Rethrow — GlobalExceptionFilter formats and sends the actual error message.
      throw error;
    }
  }

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateUserDto) {
    const data = await this.usersService.create(dto);
    return ApiResponse.created(data, API_RESPONSE_MESSAGES.users.created);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    try {
      const data = await this.usersService.findById(id);
      return ApiResponse.success(data, API_RESPONSE_MESSAGES.users.userFetched);
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  async updateRole(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateUserRoleDto,
  ) {
    try {
      if (id === req.user.sub) throw new ForbiddenException(USER_SETTINGS.messages.cannotChangeOwnRole);
      const data = await this.usersService.updateRole(id, dto.role);
      return ApiResponse.success(data, API_RESPONSE_MESSAGES.users.roleUpdated);
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  async updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateUserStatusDto,
  ) {
    try {
      if (id === req.user.sub) throw new ForbiddenException(USER_SETTINGS.messages.cannotChangeOwnStatus);
      const data = await this.usersService.updateStatus(id, dto.isActive);
      return ApiResponse.success(data, API_RESPONSE_MESSAGES.users.statusUpdated);
    } catch (error) {
      throw error;
    }
  }
}

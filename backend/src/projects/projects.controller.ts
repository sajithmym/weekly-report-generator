import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, ProjectFilterDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/enums';
import { ApiResponse } from '../common/dto';
import { API_RESPONSE_MESSAGES } from '../settings';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(@Query() filters: ProjectFilterDto) {
    try {
      const result = await this.projectsService.findAll(filters);
      return ApiResponse.paginated(result.data, result.meta, API_RESPONSE_MESSAGES.projects.fetched);
    } catch (error) {
      // Rethrow — GlobalExceptionFilter formats and sends the actual error message.
      throw error;
    }
  }

  @Get(':id')
  async findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    try {
      const data = await this.projectsService.findById(id);
      return ApiResponse.success(data, API_RESPONSE_MESSAGES.projects.projectFetched);
    } catch (error) {
      throw error;
    }
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(@Body() dto: CreateProjectDto) {
    try {
      const data = await this.projectsService.create(dto);
      return ApiResponse.created(data, API_RESPONSE_MESSAGES.projects.created);
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    try {
      const data = await this.projectsService.update(id, dto);
      return ApiResponse.success(data, API_RESPONSE_MESSAGES.projects.updated);
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    try {
      const data = await this.projectsService.remove(id);
      return ApiResponse.success(data, API_RESPONSE_MESSAGES.projects.deactivated);
    } catch (error) {
      throw error;
    }
  }
}

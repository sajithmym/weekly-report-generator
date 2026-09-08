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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportWorkflowService } from "./report-workflow.service";
import {
  CreateReportDto,
  UpdateReportDto,
  ReportFilterDto,
  RequestChangesDto,
} from "./dto";
import { JwtAuthGuard, RolesGuard } from "../common/guards";
import { Roles } from "../common/decorators";
import { UserRole } from "../common/enums";
import { ApiResponse } from "../common/dto";
import { RequestWithUser } from "../common/interfaces";
import { API_RESPONSE_MESSAGES } from "../settings";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly workflowService: ReportWorkflowService,
  ) {}

  // ─── Member Endpoints ──────────────────────────────────

  @Post("reports")
  @Roles(UserRole.TEAM_MEMBER)
  async create(@Req() req: RequestWithUser, @Body() dto: CreateReportDto) {
    try {
      const data = await this.reportsService.create(req.user.sub, dto);
      return ApiResponse.created(data, API_RESPONSE_MESSAGES.reports.created);
    } catch (error) {
      // Rethrow — GlobalExceptionFilter formats and sends the actual error message.
      throw error;
    }
  }

  @Get("reports/my")
  @Roles(UserRole.TEAM_MEMBER)
  async findMyReports(
    @Req() req: RequestWithUser,
    @Query() pagination: ReportFilterDto,
  ) {
    try {
      const result = await this.reportsService.findMyReports(
        req.user.sub,
        pagination,
      );
      return ApiResponse.paginated(
        result.data,
        result.meta,
        API_RESPONSE_MESSAGES.reports.fetched,
      );
    } catch (error) {
      throw error;
    }
  }

  @Get("reports/my/summary")
  @Roles(UserRole.TEAM_MEMBER)
  async getMySummary(@Req() req: RequestWithUser) {
    return ApiResponse.success(
      await this.reportsService.getMySummary(req.user.sub),
    );
  }

  @Get("reports/:id")
  @Roles(UserRole.TEAM_MEMBER)
  async findById(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const data = await this.reportsService.findById(
        id,
        req.user.sub,
        req.user.role,
      );
      return ApiResponse.success(
        data,
        API_RESPONSE_MESSAGES.reports.reportFetched,
      );
    } catch (error) {
      throw error;
    }
  }

  @Patch("reports/:id")
  @Roles(UserRole.TEAM_MEMBER)
  async update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateReportDto,
  ) {
    try {
      const data = await this.reportsService.update(id, req.user.sub, dto);
      return ApiResponse.success(data, API_RESPONSE_MESSAGES.reports.updated);
    } catch (error) {
      throw error;
    }
  }

  @Post("reports/:id/submit")
  @Roles(UserRole.TEAM_MEMBER)
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const data = await this.workflowService.submit(id, req.user.sub);
      return ApiResponse.success(data, API_RESPONSE_MESSAGES.reports.submitted);
    } catch (error) {
      throw error;
    }
  }

  @Get("reports/:id/versions")
  @Roles(UserRole.TEAM_MEMBER)
  async getVersionHistory(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      await this.reportsService.findById(id, req.user.sub, req.user.role);
      const data = await this.workflowService.getVersionHistory(id);
      return ApiResponse.success(
        data,
        API_RESPONSE_MESSAGES.reports.versionHistoryFetched,
      );
    } catch (error) {
      throw error;
    }
  }

  // ─── Manager Endpoints ─────────────────────────────────

  @Get("manager/reports")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  async findTeamReports(@Query() filters: ReportFilterDto) {
    try {
      const result = await this.reportsService.findByFilters(filters);
      return ApiResponse.paginated(
        result.data,
        result.meta,
        API_RESPONSE_MESSAGES.reports.fetched,
      );
    } catch (error) {
      throw error;
    }
  }

  @Get("manager/reports/:id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  async findTeamReportById(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const data = await this.reportsService.findById(
        id,
        req.user.sub,
        req.user.role,
      );
      return ApiResponse.success(
        data,
        API_RESPONSE_MESSAGES.reports.reportFetched,
      );
    } catch (error) {
      throw error;
    }
  }

  @Post("manager/reports/:id/request-changes")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async requestChanges(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: RequestChangesDto,
  ) {
    try {
      const data = await this.workflowService.requestChanges(
        id,
        req.user.sub,
        dto.comment,
      );
      return ApiResponse.success(
        data,
        API_RESPONSE_MESSAGES.reports.changesRequested,
      );
    } catch (error) {
      throw error;
    }
  }

  @Post("manager/reports/:id/approve")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Req() req: RequestWithUser,
  ) {
    try {
      const data = await this.workflowService.approve(id, req.user.sub);
      return ApiResponse.success(data, API_RESPONSE_MESSAGES.reports.approved);
    } catch (error) {
      throw error;
    }
  }
}

import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
  IsUUID,
  IsIn,
  Matches,
} from "class-validator";
import { PaginationDto } from "../../common/dto";
import { DASHBOARD_SETTINGS, PAGINATION_SETTINGS, REPORT_SETTINGS, VALIDATION_SETTINGS } from "../../settings";

export class DashboardDateFilterDto {
  @IsOptional()
  @Matches(VALIDATION_SETTINGS.datePattern)
  @IsDateString()
  weekStart?: string;

  @IsOptional()
  @Matches(VALIDATION_SETTINGS.datePattern)
  @IsDateString()
  weekEnd?: string;
}

export class TaskTrendFilterDto {
  @IsOptional()
  @Matches(VALIDATION_SETTINGS.datePattern)
  @IsDateString()
  weekEnd?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGINATION_SETTINGS.defaultPage)
  @Max(REPORT_SETTINGS.calendar.maxSelectableWeeks)
  weeks: number = DASHBOARD_SETTINGS.defaultTaskTrendWeeks;
}

export class ActivityFilterDto extends DashboardDateFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGINATION_SETTINGS.defaultPage)
  @Max(PAGINATION_SETTINGS.maxLimit)
  limit: number = DASHBOARD_SETTINGS.defaultActivityLimit;
}

export class RosterFilterDto extends PaginationDto {
  @IsOptional()
  @Matches(VALIDATION_SETTINGS.datePattern)
  @IsDateString()
  weekStart?: string;

  @IsOptional()
  @Matches(VALIDATION_SETTINGS.datePattern)
  @IsDateString()
  weekEnd?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(REPORT_SETTINGS.rosterStatuses)
  status?: string;
}

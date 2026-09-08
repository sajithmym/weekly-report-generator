import { IsOptional, IsDateString, IsEnum, IsUUID, Matches } from 'class-validator';
import { PaginationDto } from '../../common/dto';
import { ReportStatus } from '../../common/enums';
import { VALIDATION_SETTINGS } from '../../settings';

export class ReportFilterDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @Matches(VALIDATION_SETTINGS.datePattern)
  @IsDateString()
  weekStart?: string;

  @IsOptional()
  @Matches(VALIDATION_SETTINGS.datePattern)
  @IsDateString()
  weekEnd?: string;
}

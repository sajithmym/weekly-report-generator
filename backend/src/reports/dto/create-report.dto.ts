import {
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsEnum,
  MaxLength,
  IsBoolean,
  IsUUID,
  ArrayMaxSize,
  ValidateIf,
  MinLength,
  Matches,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { REPORT_SETTINGS, VALIDATION_SETTINGS } from "../../settings";

class CreateTaskDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MinLength(VALIDATION_SETTINGS.taskName.min)
  @MaxLength(VALIDATION_SETTINGS.taskName.max)
  taskName: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(REPORT_SETTINGS.taskPriorities)
  priority?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(VALIDATION_SETTINGS.percentage.min)
  @Max(VALIDATION_SETTINGS.percentage.max)
  plannedPercentage?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(VALIDATION_SETTINGS.percentage.min)
  @Max(VALIDATION_SETTINGS.percentage.max)
  actualPercentage?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(REPORT_SETTINGS.taskStatuses)
  status?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(VALIDATION_SETTINGS.minutes.min)
  @Max(VALIDATION_SETTINGS.minutes.max)
  plannedMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(VALIDATION_SETTINGS.minutes.min)
  @Max(VALIDATION_SETTINGS.minutes.max)
  actualMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(VALIDATION_SETTINGS.deliverable.max)
  deliverable?: string;
}

class CreateNextWeekTaskDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MinLength(VALIDATION_SETTINGS.description.min)
  @MaxLength(VALIDATION_SETTINGS.description.max)
  description: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(VALIDATION_SETTINGS.sortOrder.min)
  sortOrder?: number;
}

class CreateBlockerDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MinLength(VALIDATION_SETTINGS.description.min)
  @MaxLength(VALIDATION_SETTINGS.description.max)
  description: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isKeyIssue?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isResolved?: boolean;
}

class CreateAchievementDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MinLength(VALIDATION_SETTINGS.description.min)
  @MaxLength(VALIDATION_SETTINGS.description.max)
  description: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isKeyAchievement?: boolean;
}

class CreateWorkHourDto {
  @IsEnum(REPORT_SETTINGS.workHourTypes)
  type: string;

  @IsInt()
  @Min(VALIDATION_SETTINGS.minutes.min)
  @Max(VALIDATION_SETTINGS.minutes.max)
  minutes: number;
}

export class CreateReportDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  projectId?: string | null;

  @Matches(VALIDATION_SETTINGS.datePattern)
  @IsDateString({ strict: true })
  weekStart: string;

  @Matches(VALIDATION_SETTINGS.datePattern)
  @IsDateString({ strict: true })
  weekEnd: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(VALIDATION_SETTINGS.reportNotes.max)
  notes?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(REPORT_SETTINGS.maxItemsPerSection)
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  tasks?: CreateTaskDto[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(REPORT_SETTINGS.maxItemsPerSection)
  @ValidateNested({ each: true })
  @Type(() => CreateNextWeekTaskDto)
  nextWeekTasks?: CreateNextWeekTaskDto[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(REPORT_SETTINGS.maxItemsPerSection)
  @ValidateNested({ each: true })
  @Type(() => CreateBlockerDto)
  blockers?: CreateBlockerDto[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(REPORT_SETTINGS.maxItemsPerSection)
  @ValidateNested({ each: true })
  @Type(() => CreateAchievementDto)
  achievements?: CreateAchievementDto[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(REPORT_SETTINGS.maxItemsPerSection)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkHourDto)
  workHours?: CreateWorkHourDto[];
}

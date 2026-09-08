import { Transform } from 'class-transformer';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { VALIDATION_SETTINGS } from '../../settings';

export class CreateProjectDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(VALIDATION_SETTINGS.projectName.min)
  @MaxLength(VALIDATION_SETTINGS.projectName.max)
  name: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(VALIDATION_SETTINGS.projectDescription.max)
  description?: string;
}

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { VALIDATION_SETTINGS } from '../../settings';

export class RequestChangesDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_SETTINGS.reportNotes.max)
  comment: string;
}

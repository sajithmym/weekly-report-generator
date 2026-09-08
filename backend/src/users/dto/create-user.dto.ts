import { Transform } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { UserRole } from "../../common/enums";
import { VALIDATION_SETTINGS } from "../../settings";

export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(VALIDATION_SETTINGS.name.min)
  @MaxLength(VALIDATION_SETTINGS.name.max)
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(VALIDATION_SETTINGS.password.min)
  @MaxLength(VALIDATION_SETTINGS.password.max)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

import { Transform } from "class-transformer";
import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";
import { VALIDATION_SETTINGS } from "../../settings";

export class RegisterDto {
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
}

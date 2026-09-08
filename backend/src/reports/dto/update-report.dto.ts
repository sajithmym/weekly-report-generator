import { PartialType } from "@nestjs/mapped-types";
import { IsOptional } from "class-validator";
import { CreateReportDto } from "./create-report.dto";

export class UpdateReportDto extends PartialType(CreateReportDto, {
  skipNullProperties: false,
}) {
  // A draft may clear its project. The workflow still requires one before submit.
  @IsOptional()
  projectId?: string | null;
}

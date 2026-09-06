import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { REPORT_SETTINGS } from "../settings";

/** The preflight uniqueness check can race; the database remains the final authority. */
export function rethrowReportWriteError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = error.meta?.target;
    if (
      Array.isArray(target) &&
      (target.includes("user_id") || target.includes("userId")) &&
      (target.includes("week_start") || target.includes("weekStart"))
    ) {
      throw new BadRequestException(
        REPORT_SETTINGS.messages.reportAlreadyExists,
      );
    }
  }
  throw error;
}

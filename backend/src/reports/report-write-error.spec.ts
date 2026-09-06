import { Prisma } from "@prisma/client";
import { rethrowReportWriteError } from "./report-write-error";

describe("report write errors", () => {
  it.each([
    ["user_id", "week_start"],
    ["userId", "weekStart"],
  ])(
    "translates the weekly uniqueness constraint into an actionable conflict",
    (...target) => {
      const error = new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
        meta: { target },
      });
      expect(() => rethrowReportWriteError(error)).toThrow(
        "A weekly report already exists for this week.",
      );
    },
  );

  it("preserves unrelated errors instead of claiming a duplicate report", () => {
    expect.assertions(2);
    for (const error of [
      new Error("Connection lost"),
      new Prisma.PrismaClientKnownRequestError("duplicate id", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["id"] },
      }),
    ]) {
      try {
        rethrowReportWriteError(error);
      } catch (caught) {
        expect(caught).toBe(error);
      }
    }
  });
});

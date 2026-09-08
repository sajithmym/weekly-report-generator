import { BadRequestException, Logger, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { GlobalExceptionFilter } from "./http-exception.filter";

describe("GlobalExceptionFilter", () => {
  const createHost = () => {
    const response = {
      status: jest.fn(),
      json: jest.fn(),
    };
    response.status.mockReturnValue(response);
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: "POST", url: "/api/v1/reports" }),
      }),
    };
    return { host, response };
  };

  it("formats validation exceptions as the standard client error envelope", () => {
    const { host, response } = createHost();
    new GlobalExceptionFilter().catch(
      new BadRequestException(["name must be longer", "email must be an email"]),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "name must be longer, email must be an email",
        data: null,
      }),
    );
  });

  it("preserves service-unavailable status in the standard error envelope", () => {
    const { host, response } = createHost();
    new GlobalExceptionFilter().catch(
      new ServiceUnavailableException("Service is unhealthy"),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Service is unhealthy",
      }),
    );
  });

  it("maps known Prisma constraint failures without leaking implementation details", () => {
    const { host, response } = createHost();
    const duplicate = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "5.10.0",
      meta: { target: ["email"] },
    });
    const logger = jest.spyOn(Logger.prototype, "error").mockImplementation();
    try {
      new GlobalExceptionFilter().catch(duplicate, host as never);

      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "DUPLICATE_RECORD",
          message: "A record with this email already exists",
        }),
      );
    } finally {
      logger.mockRestore();
    }
  });

  it("returns an internal-error envelope for unexpected failures and logs the cause", () => {
    const { host, response } = createHost();
    const logger = jest.spyOn(Logger.prototype, "error").mockImplementation();
    try {
      new GlobalExceptionFilter().catch(new Error("database connection lost"), host as never);
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "INTERNAL_ERROR",
          message: "database connection lost",
        }),
      );
      expect(logger).toHaveBeenCalled();
    } finally {
      logger.mockRestore();
    }
  });

  it("does not write query-string values to unexpected-error logs", () => {
    const { host } = createHost();
    const logger = jest.spyOn(Logger.prototype, "error").mockImplementation();
    try {
      const request = host.switchToHttp().getRequest();
      request.url = "/api/v1/reports?accessToken=private-value";
      new GlobalExceptionFilter().catch(new Error("database connection lost"), host as never);

      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining("[POST] /api/v1/reports → 500 INTERNAL_ERROR"),
        expect.any(String),
      );
      expect(logger).not.toHaveBeenCalledWith(
        expect.stringContaining("private-value"),
        expect.anything(),
      );
    } finally {
      logger.mockRestore();
    }
  });
});

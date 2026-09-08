import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ApiResponse } from '../dto';
import { SERVER_SETTINGS } from '../../settings';

interface ResolvedError {
  status: number;
  message: string;
  code: string;
}

/**
 * Single point that converts every thrown error into the unified
 * `ApiResponse` error envelope and sends the *actual* error message
 * (translated to something meaningful) to the UI.
 *
 * Layering:
 *  - Services throw typed HttpExceptions with actionable messages.
 *  - Controllers wrap endpoints in try/catch and rethrow.
 *  - This filter maps HttpExceptions, Prisma errors, and unexpected
 *    errors to the correct status code + message and formats the body.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, code } = this.resolveError(exception);

    // Log unexpected (non-HTTP) failures with request context.
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `[${request.method}] ${request.path || request.url.split('?')[0]} → ${status} ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(ApiResponse.error(status, message, code));
  }

  private resolveError(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message:
          SERVER_SETTINGS.nodeEnv === 'production'
            ? 'Invalid data provided'
            : `Invalid data provided: ${exception.message.split('\n')[0]}`,
        code: 'VALIDATION_ERROR',
      };
    }

    if (exception instanceof Error) {
      // Never leak internal details in production — log them instead.
      const message =
        SERVER_SETTINGS.nodeEnv === 'production'
          ? 'Internal server error'
          : exception.message || 'Internal server error';

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        code: 'INTERNAL_ERROR',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    };
  }

  private resolveHttpException(exception: HttpException): ResolvedError {
    const status = exception.getStatus();
    const responseBody = exception.getResponse();
    const code = this.statusToCode(status);

    if (typeof responseBody === 'string') {
      return { status, message: responseBody, code };
    }

    if (typeof responseBody === 'object' && responseBody !== null) {
      const body = responseBody as Record<string, unknown>;

      // Support custom `code` supplied via HttpException({ message, code }, status)
      const customCode = typeof body.code === 'string' ? body.code : code;

      // ValidationPipe produces `message: string[]` — join into one readable message.
      const rawMessage = body.message;
      let message = 'Request failed';

      if (Array.isArray(rawMessage)) {
        message = rawMessage.join(', ');
      } else if (typeof rawMessage === 'string') {
        message = rawMessage;
      } else if (typeof body.error === 'string') {
        message = body.error;
      }

      return { status, message, code: customCode };
    }

    return { status, message: 'Request failed', code };
  }

  private resolvePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ResolvedError {
    const target = Array.isArray(exception.meta?.target)
      ? (exception.meta.target as string[]).join(', ')
      : '';

    switch (exception.code) {
      case 'P2002': // Unique constraint violation
        return {
          status: HttpStatus.CONFLICT,
          message: target
            ? `A record with this ${target} already exists`
            : 'A record with these values already exists',
          code: 'DUPLICATE_RECORD',
        };
      case 'P2025': // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          code: 'NOT_FOUND',
        };
      case 'P2003': // Foreign key constraint violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'The related record does not exist',
          code: 'RELATED_RECORD_NOT_FOUND',
        };
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Provided value is too long for the database column',
          code: 'VALUE_TOO_LONG',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          message:
            SERVER_SETTINGS.nodeEnv === 'production'
              ? 'Unable to process the request'
              : `Database error: ${exception.message}`,
          code: 'DATABASE_ERROR',
        };
    }
  }

  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'ERROR';
    }
  }
}

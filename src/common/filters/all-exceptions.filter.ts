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

const GENERIC_INTERNAL_MESSAGE = 'Something went wrong. Please try again later.';
const SERVICE_UNAVAILABLE_MESSAGE =
  'Service temporarily unavailable. Please try again in a few minutes.';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = GENERIC_INTERNAL_MESSAGE;
    let errors: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          errors = resObj.message;
        } else if (resObj.error) {
          errors = resObj.error;
        }
      }
    } else {
      const mapped = this.mapNonHttpException(exception);
      status = mapped.status;
      message = mapped.message;

      if (exception instanceof Error) {
        this.logger.error(
          `Unhandled Exception on ${request.method} ${request.url}: ${exception.message}`,
          exception.stack,
        );
      } else {
        this.logger.error(
          `Unhandled non-Error exception on ${request.method} ${request.url}`,
          JSON.stringify(exception),
        );
      }
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        ...(errors && { errors }),
      },
    });
  }

  /**
   * Internal failures (Prisma, driver, runtime) must never surface raw engine
   * messages to clients: they leak schema, credentials and infrastructure detail.
   */
  private mapNonHttpException(exception: unknown): { status: HttpStatus; message: string } {
    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      this.isDatabaseConnectivityError(exception)
    ) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: SERVICE_UNAVAILABLE_MESSAGE,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            message: 'This record already exists.',
          };
        case 'P2003':
        case 'P2014':
          return {
            status: HttpStatus.BAD_REQUEST,
            message: 'This action conflicts with related records.',
          };
        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            message: 'The requested record was not found.',
          };
        default:
          return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: GENERIC_INTERNAL_MESSAGE,
          };
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid request data.',
      };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: GENERIC_INTERNAL_MESSAGE };
  }

  private isDatabaseConnectivityError(exception: unknown): boolean {
    if (!(exception instanceof Error)) return false;

    const code = (exception as { code?: string }).code;
    // Prisma P1xxx = connection/auth level failures; Postgres SQLSTATE 28P01 /
    // 28000 = auth failure, 3D000 = missing database.
    const connectivityCodes = [
      'P1000',
      'P1001',
      'P1002',
      'P1008',
      'P1010',
      'P1017',
      '28P01',
      '28000',
      '3D000',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
    ];
    if (code && connectivityCodes.includes(code)) {
      return true;
    }

    return /authentication failed|password authentication|database server|connection (refused|terminated)/i.test(
      exception.message,
    );
  }
}

// src/common/filters/all-exceptions.filter.ts
import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let code = 'INTERNAL_SERVER_ERROR';
        let message = 'An unexpected error occurred';
        let details: Record<string, any> | undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                const res = exceptionResponse as Record<string, any>;
                message = res.message ?? message;
                details = Array.isArray(res.message) ? { errors: res.message } : undefined;
                code = res.error ?? code;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
        }

        this.logger.error(
            `[${request.method}] ${request.url} => ${status} ${message}`,
        );

        response.status(status).json({
            success: false,
            error: {
                code,
                message,
                ...(details && { details }),
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    }
}

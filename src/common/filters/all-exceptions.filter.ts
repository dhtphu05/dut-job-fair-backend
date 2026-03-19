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

    private sanitize(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.sanitize(item));
        }

        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(([key, val]) => {
                    const lowered = key.toLowerCase();
                    if (
                        lowered.includes('password') ||
                        lowered.includes('token') ||
                        lowered === 'authorization'
                    ) {
                        return [key, '[REDACTED]'];
                    }
                    return [key, this.sanitize(val)];
                }),
            );
        }

        return value;
    }

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

        const logContext = {
            params: this.sanitize(request.params),
            query: this.sanitize(request.query),
            body: this.sanitize(request.body),
        };

        if (exception instanceof Error) {
            this.logger.error(
                `[${request.method}] ${request.url} => ${status} ${message} ${JSON.stringify(logContext)}`,
                exception.stack,
            );
        } else {
            this.logger.error(
                `[${request.method}] ${request.url} => ${status} ${message} ${JSON.stringify(logContext)}`,
            );
        }

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

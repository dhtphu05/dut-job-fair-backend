// src/common/interceptors/transform.interceptor.ts
import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, { data: T; status: number }> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<{ data: T; status: number }> {
        const httpContext = context.switchToHttp();
        const response = httpContext.getResponse<{ statusCode: number }>();

        return next.handle().pipe(
            map((data) => ({
                data,
                status: response.statusCode,
            })),
        );
    }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dto/response.dto';

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponseDto<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T>> {
    return next.handle().pipe(
      map((res) => {
        // If response is already wrapped in ApiResponseDto format
        if (
          res &&
          typeof res === 'object' &&
          'success' in res &&
          'message' in res &&
          'data' in res
        ) {
          return res;
        }

        let message = 'Operation completed successfully';
        let data = res;
        let meta: Record<string, any> | undefined = undefined;

        if (res && typeof res === 'object') {
          if (res.message && typeof res.message === 'string' && res.data !== undefined) {
            message = res.message;
            data = res.data;
            meta = res.meta;
          } else if (res.data !== undefined && res.meta !== undefined) {
            data = res.data;
            meta = res.meta;
          }
        }

        return new ApiResponseDto(true, message, data ?? null, meta);
      }),
    );
  }
}

export class ApiResponseDto<T> {
  success: boolean;
  message: string;
  data: T | null;
  meta?: Record<string, any>;

  constructor(success: boolean, message: string, data: T | null = null, meta?: Record<string, any>) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }
}

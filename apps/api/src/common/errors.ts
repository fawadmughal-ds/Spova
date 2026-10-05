import { HttpException, HttpStatus } from '@nestjs/common';

/** Error shape on the wire: { code, message, details? } (ARCHITECTURE §04). */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new ApiError(HttpStatus.BAD_REQUEST, code, message, details);
  }
  static unauthorized(code = 'unauthorized', message = 'Authentication required') {
    return new ApiError(HttpStatus.UNAUTHORIZED, code, message);
  }
  static forbidden(code = 'forbidden', message = 'Not allowed') {
    return new ApiError(HttpStatus.FORBIDDEN, code, message);
  }
  static notFound(code = 'not_found', message = 'Not found') {
    return new ApiError(HttpStatus.NOT_FOUND, code, message);
  }
  static conflict(code: string, message: string, details?: unknown) {
    return new ApiError(HttpStatus.CONFLICT, code, message, details);
  }
  static unprocessable(code: string, message: string, details?: unknown) {
    return new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, code, message, details);
  }
  static tooMany(message = 'Too many requests') {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, 'rate_limited', message);
  }
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body) {
        return res.status(status).json(body);
      }
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      return res.status(status).json({
        code: HttpStatus[status]?.toLowerCase() ?? 'error',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return res.status(409).json({ code: 'conflict', message: 'Already exists', details: exception.meta });
      }
      if (exception.code === 'P2025') {
        return res.status(404).json({ code: 'not_found', message: 'Not found' });
      }
    }

    this.log.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(500).json({ code: 'internal', message: 'Internal server error' });
  }
}

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../errors/ApiError';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 'XX000' &&
    'message' in err &&
    typeof err.message === 'string' &&
    err.message.includes('max clients reached in session mode')
  ) {
    return res.status(503).json({
      error: 'Database connection limit reached',
      code: 'DATABASE_CONNECTION_LIMIT',
    });
  }

  console.error('Unhandled backend error:', err);

  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
};

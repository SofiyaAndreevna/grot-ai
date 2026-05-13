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

  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
};

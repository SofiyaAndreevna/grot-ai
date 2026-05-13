type ApiErrorCode = 'API_ERROR' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR' | 'EPIC_NAME_CONFLICT' | 'EPIC_NOT_FOUND';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode | string;
  readonly details: unknown;

  constructor(statusCode: number, message: string, code: ApiErrorCode | string = 'API_ERROR', details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

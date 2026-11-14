/**
 * An expected failure that is safe to show to the API client, such as
 * "order not found". Anything else reaching the error handler is treated as a
 * bug and answered with a generic 500 so internals never leak.
 */
export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

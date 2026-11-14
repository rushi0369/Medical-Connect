import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';

// Errors raised by express.json() while reading the request body.
const BODY_PARSER_ERRORS = {
  'entity.parse.failed': {
    statusCode: 400,
    code: 'INVALID_JSON',
    message: 'The request body is not valid JSON.',
  },
  'entity.too.large': {
    statusCode: 413,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'The request body is too large.',
  },
};

const DUPLICATE_FIELD_MESSAGES = {
  phone: 'This mobile number is already registered.',
  email: 'This email address is already registered.',
};

const DATABASE_UNAVAILABLE_ERRORS = new Set([
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
]);

function toKnownError(err) {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message, details: err.details };
  }

  if (BODY_PARSER_ERRORS[err.type]) return BODY_PARSER_ERRORS[err.type];

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0];
    const message = DUPLICATE_FIELD_MESSAGES[field] ?? 'This value is already in use.';
    return {
      statusCode: 409,
      code: 'DUPLICATE_VALUE',
      message,
      details: DUPLICATE_FIELD_MESSAGES[field] ? { fieldErrors: { [field]: [message] } } : undefined,
    };
  }

  if (err.name === 'ValidationError') {
    const fieldErrors = {};
    for (const [field, problem] of Object.entries(err.errors ?? {})) {
      fieldErrors[field] = [problem.message];
    }
    return {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Please check the highlighted fields.',
      details: { fieldErrors },
    };
  }

  if (DATABASE_UNAVAILABLE_ERRORS.has(err.name)) {
    return {
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'We cannot reach the database right now. Please try again in a moment.',
    };
  }

  return null;
}

// Express only treats a middleware as an error handler if it has all 4 arguments.
export function errorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err);

  const known = toKnownError(err);
  if (known) return sendError(res, known);

  // Unexpected: log the real cause on the server, send nothing internal to the client.
  console.error(err);
  return sendError(res, {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong on the server. Please try again.',
  });
}

import { AppError } from '../utils/AppError.js';

/**
 * Checks incoming data against Zod schemas. Controllers read the cleaned result
 * from req.validated, so they never see unchecked or unexpected fields.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.validated = {};
    const fieldErrors = {};
    const formErrors = [];

    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source] ?? {});

      if (result.success) {
        req.validated[source] = result.data;
        continue;
      }

      for (const issue of result.error.issues) {
        if (issue.path.length === 0) {
          formErrors.push(issue.message);
        } else {
          const field = issue.path.join('.');
          (fieldErrors[field] ??= []).push(issue.message);
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0 || formErrors.length > 0) {
      console.error('Validation failed on', req.method, req.originalUrl, 'Errors:', JSON.stringify(fieldErrors), formErrors);
      return next(
        new AppError(422, 'VALIDATION_ERROR', formErrors[0] ?? 'Please check the highlighted fields.', {
          fieldErrors,
        }),
      );
    }

    return next();
  };
}

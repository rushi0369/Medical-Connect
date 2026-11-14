/**
 * Every API response uses one of these two shapes, so the frontend can handle
 * them all the same way:
 *
 *   Success: { success: true,  message, data, meta? }
 *   Failure: { success: false, error: { code, message, details? } }
 */
export function sendSuccess(res, { statusCode = 200, message, data, meta }) {
  return res.status(statusCode).json({ success: true, message, data, meta });
}

export function sendError(res, { statusCode, code, message, details }) {
  return res.status(statusCode).json({ success: false, error: { code, message, details } });
}

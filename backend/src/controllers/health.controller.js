import { getDatabaseStatus } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Always answers 200 with the same shape when the API process is alive. Whether
 * the system is fully usable is reported in data.status.
 */
export function getHealth(_req, res) {
  const databaseStatus = getDatabaseStatus();
  const isHealthy = databaseStatus === 'connected';

  return sendSuccess(res, {
    message: isHealthy ? 'CK Medical API is running.' : 'CK Medical API is running without a database connection.',
    data: {
      service: 'medicare-api',
      status: isHealthy ? 'ok' : 'degraded',
      database: { status: databaseStatus },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
}

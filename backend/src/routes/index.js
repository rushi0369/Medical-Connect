import { Router } from 'express';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import customerRoutes from './customer.routes.js';
import healthRoutes from './health.routes.js';
import notificationRoutes from './notification.routes.js';
import riderRoutes from './rider.routes.js';

const router = Router();

// Mounted before the limiter so that status checks are never throttled.
router.use('/health', healthRoutes);

router.use(apiLimiter);

router.use('/auth', requireDatabase, authRoutes);
router.use('/admin', requireDatabase, adminRoutes);
router.use('/customers', requireDatabase, customerRoutes);
router.use('/riders', requireDatabase, riderRoutes);
router.use('/notifications', requireDatabase, notificationRoutes);

router.get('/settings', requireDatabase, async (_req, res, next) => {
  try {
    const { getStoreSettings } = await import('../services/settings.service.js');
    const { sendSuccess } = await import('../utils/apiResponse.js');
    return sendSuccess(res, { data: await getStoreSettings() });
  } catch (err) {
    next(err);
  }
});

export default router;

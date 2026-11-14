import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as notifications from '../controllers/notification.controller.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamsSchema, paginationSchema } from '../validators/common.js';

const router = Router();

router.use(requireRole(...Object.values(ROLES)));

router.get('/', validate({ query: paginationSchema }), notifications.listMyNotifications);
router.patch('/read-all', notifications.markAllNotificationsRead);
router.patch('/:id/read', validate({ params: idParamsSchema }), notifications.markNotificationRead);
router.delete('/:id', requireRole(ROLES.ADMIN), validate({ params: idParamsSchema }), notifications.deleteNotification);
router.post('/bulk-delete', requireRole(ROLES.ADMIN), notifications.bulkDeleteNotifications);

export default router;

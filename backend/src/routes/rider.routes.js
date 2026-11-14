import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as riders from '../controllers/rider.controller.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamsSchema } from '../validators/common.js';
import {
  createRiderSchema,
  listRiderDeliveriesQuerySchema,
  listRidersQuerySchema,
  riderCollectCashSchema,
  riderDeliveryActionSchema,
  riderStatusSchema,
  updateRiderSchema,
} from '../validators/rider.validators.js';

const router = Router();

// A rider only ever sees their own figures and deliveries.
router.get('/me/summary', requireRole(ROLES.RIDER), riders.getMySummary);
router.get('/me/deliveries', requireRole(ROLES.RIDER), validate({ query: listRiderDeliveriesQuerySchema }), riders.getMyDeliveries);
router.get('/me/deliveries/:id', requireRole(ROLES.RIDER), validate({ params: idParamsSchema }), riders.getDelivery);
router.post('/me/deliveries/:id/action', requireRole(ROLES.RIDER), validate({ params: idParamsSchema, body: riderDeliveryActionSchema }), riders.updateDeliveryStatus);
router.post('/me/deliveries/:id/collect-cash', requireRole(ROLES.RIDER), validate({ params: idParamsSchema, body: riderCollectCashSchema }), riders.recordCashCollection);
router.post('/me/deliveries/:id/confirm-online', requireRole(ROLES.RIDER), validate({ params: idParamsSchema }), riders.confirmOnlinePayment);

// Everything below manages rider accounts, which only the admin can do.
router.use(requireRole(ROLES.ADMIN));

router.get('/', validate({ query: listRidersQuerySchema }), riders.listRiders);
router.post('/', validate({ body: createRiderSchema }), riders.createRider);
router.get('/:id', validate({ params: idParamsSchema }), riders.getRider);
router.patch('/:id', validate({ params: idParamsSchema, body: updateRiderSchema }), riders.updateRider);
router.patch('/:id/status', validate({ params: idParamsSchema, body: riderStatusSchema }), riders.setRiderStatus);
router.post('/:id/reset-credentials', validate({ params: idParamsSchema }), riders.resetRiderCredentials);
router.delete('/:id', validate({ params: idParamsSchema }), riders.deleteRider);
router.post('/bulk-delete', riders.bulkDeleteRiders);

export default router;

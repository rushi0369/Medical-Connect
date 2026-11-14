import { getRiderDeliveryStats, getRiderSummary } from '../services/dashboard.service.js';
import {
  collectCash,
  confirmOnlinePayment as confirmOnlinePaymentService,
  getDeliveryDetail,
  listDeliveries,
  riderUpdate,
} from '../services/delivery.service.js';
import * as riderService from '../services/rider.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { serializeUser } from '../utils/serializeUser.js';

export async function listRiders(req, res) {
  const { page, pageSize, search, status } = req.validated.query;
  const { riders, totalItems } = await riderService.listRiders({ page, pageSize, search, status });
  const stats = await getRiderDeliveryStats(riders.map((rider) => rider._id));

  return sendSuccess(res, {
    message: 'Riders loaded.',
    data: riders.map((rider) => ({
      ...serializeUser(rider),
      deliveryStats: stats.get(rider.id) ?? { assigned: 0, completed: 0 },
    })),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  });
}

export async function getMySummary(req, res) {
  return sendSuccess(res, { message: 'Dashboard summary loaded.', data: await getRiderSummary(req.user._id) });
}

export async function getRider(req, res) {
  const rider = await riderService.getRider(req.validated.params.id);

  return sendSuccess(res, { message: 'Rider loaded.', data: { rider: serializeUser(rider) } });
}

export async function createRider(req, res) {
  const { rider, temporaryPassword } = await riderService.createRider(req.validated.body, req.user, req);

  return sendSuccess(res, {
    statusCode: 201,
    message: `Rider account ${rider.riderProfile.riderId} has been created.`,
    data: { rider: serializeUser(rider), temporaryPassword },
  });
}

export async function updateRider(req, res) {
  const rider = await riderService.updateRider(req.validated.params.id, req.validated.body, req.user, req);

  return sendSuccess(res, { message: 'Rider details have been saved.', data: { rider: serializeUser(rider) } });
}

export async function setRiderStatus(req, res) {
  const { isActive } = req.validated.body;
  const rider = await riderService.setRiderActive(req.validated.params.id, isActive, req.user, req);

  return sendSuccess(res, {
    message: isActive ? 'The rider has been activated.' : 'The rider has been deactivated and signed out.',
    data: { rider: serializeUser(rider) },
  });
}

export async function resetRiderCredentials(req, res) {
  const { rider, temporaryPassword } = await riderService.resetRiderCredentials(req.validated.params.id, req.user, req);

  return sendSuccess(res, {
    message: 'A new temporary password has been created.',
    data: { rider: serializeUser(rider), temporaryPassword },
  });
}

export async function deleteRider(req, res) {
  const result = await riderService.deleteRider(req.validated.params.id, req.user, req);
  return sendSuccess(res, {
    message: `Rider ${result.riderName} was deleted permanently from database.`,
    data: result,
  });
}

export async function bulkDeleteRiders(req, res) {
  const { riderIds } = req.body || {};
  const result = await riderService.deleteRiders(riderIds, req.user, req);
  return sendSuccess(res, {
    message: `Successfully deleted ${result.deletedCount} rider(s) from database.`,
    data: result,
  });
}

// Rider Delivery Handlers
export async function getMyDeliveries(req, res) {
  const { page, pageSize, scope } = req.validated.query;
  const { deliveries, totalItems } = await listDeliveries({
    viewer: req.user,
    scope,
    page,
    pageSize,
  });

  return sendSuccess(res, {
    data: deliveries,
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  });
}

export async function getDelivery(req, res) {
  const detail = await getDeliveryDetail(req.validated.params.id, req.user);
  return sendSuccess(res, { data: detail });
}

export async function updateDeliveryStatus(req, res) {
  const { action, reason, notes } = req.validated.body;
  const delivery = await riderUpdate(req.validated.params.id, action, { reason, notes }, req.user, req);

  return sendSuccess(res, {
    message: `Delivery updated: ${action}`,
    data: { delivery },
  });
}

export async function recordCashCollection(req, res) {
  const payment = await collectCash(req.validated.params.id, req.validated.body, req.user, req);

  return sendSuccess(res, {
    message: 'Cash collection recorded successfully.',
    data: { payment },
  });
}

export async function confirmOnlinePayment(req, res) {
  const payment = await confirmOnlinePaymentService(req.validated.params.id, req.user, req);

  return sendSuccess(res, {
    message: 'Online payment confirmed successfully by rider.',
    data: { payment },
  });
}

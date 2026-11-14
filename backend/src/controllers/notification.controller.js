import { ROLES } from '../config/constants.js';
import { Notification } from '../models/Notification.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';

const serializeNotification = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  orderId: notification.order?.toString() ?? null,
  isRead: Boolean(notification.readAt),
  createdAt: notification.createdAt,
});

// Every query is limited to the logged-in user, so nobody can read another person's messages.
export async function listMyNotifications(req, res) {
  const { page, pageSize } = req.validated.query;
  const recipient = req.user._id;

  const [notifications, totalItems, unreadCount] = await Promise.all([
    Notification.find({ recipient })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Notification.countDocuments({ recipient }),
    Notification.countDocuments({ recipient, readAt: { $exists: false } }),
  ]);

  return sendSuccess(res, {
    message: 'Notifications loaded.',
    data: notifications.map(serializeNotification),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize), unreadCount },
  });
}

export async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.validated.params.id, recipient: req.user._id },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!notification) throw new AppError(404, 'NOT_FOUND', 'That notification could not be found.');

  return sendSuccess(res, { message: 'Notification marked as read.', data: serializeNotification(notification) });
}

export async function markAllNotificationsRead(req, res) {
  await Notification.updateMany(
    { recipient: req.user._id, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );

  return sendSuccess(res, { message: 'All notifications marked as read.', data: null });
}

export async function deleteNotification(req, res) {
  if (req.user.role !== ROLES.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'Only administrators can delete notifications.');
  }
  const result = await Notification.findByIdAndDelete(req.validated.params.id);
  if (!result) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  return sendSuccess(res, { message: 'Notification deleted permanently.' });
}

export async function bulkDeleteNotifications(req, res) {
  if (req.user.role !== ROLES.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'Only administrators can delete notifications.');
  }
  const { notificationIds } = req.body || {};
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return sendSuccess(res, { message: 'No notifications specified.', data: { deletedCount: 0 } });
  }
  const result = await Notification.deleteMany({ _id: { $in: notificationIds } });
  return sendSuccess(res, { message: `Deleted ${result.deletedCount} notification(s).`, data: { deletedCount: result.deletedCount } });
}

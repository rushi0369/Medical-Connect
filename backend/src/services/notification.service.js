import { ROLES } from '../config/constants.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { emitToUsers } from '../sockets/index.js';

/**
 * Saves a notification for each recipient, then pushes it live. Use to: 'admins' to
 * reach every active admin. Call only after the change it describes is saved.
 */
export async function notify({ to, type, title, message, order }) {
  const recipients =
    to === 'admins'
      ? (await User.find({ role: ROLES.ADMIN, isActive: true }).select('_id')).map((admin) => admin._id)
      : [to].flat().filter(Boolean);

  if (recipients.length === 0) return;

  const saved = await Notification.insertMany(
    recipients.map((recipient) => ({ recipient, type, title, message, order: order?._id ?? order })),
  );

  for (const notification of saved) {
    emitToUsers([notification.recipient], 'notification:new', {
      id: notification.id,
      type,
      title,
      message,
      orderId: notification.order?.toString() ?? null,
    });
  }
}

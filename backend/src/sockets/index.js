import { Server } from 'socket.io';
import { ROLES } from '../config/constants.js';
import { env } from '../config/env.js';
import { SESSION_COOKIE_NAME, userFromSessionToken } from '../services/auth.service.js';

let io = null;

function readCookie(header = '', name) {
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

const idOf = (value) => (value ? String(value._id ?? value) : null);

/**
 * Live updates. Every connection must carry a valid login cookie, and the server
 * alone decides which rooms it joins, so nobody can listen to another person's room.
 */
export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    serveClient: false,
    cors: { origin: env.CLIENT_URL, credentials: true },
    // Browsers do not apply CORS to WebSockets, so the website address is checked here too.
    allowRequest: (req, callback) => callback(null, req.headers.origin === env.CLIENT_URL),
  });

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE_NAME);
      const session = token ? await userFromSessionToken(token) : null;
      if (!session || session.user.mustChangePassword) return next(new Error('NOT_AUTHENTICATED'));

      socket.data.userId = session.user.id;
      socket.data.role = session.user.role;
      return next();
    } catch {
      return next(new Error('NOT_AUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    if (socket.data.role === ROLES.ADMIN) socket.join('admins');
  });

  return io;
}

export async function closeRealtime() {
  if (io) await io.close();
  io = null;
}

export function emitToUsers(users, event, payload) {
  if (!io) return;
  for (const id of new Set(users.map(idOf).filter(Boolean))) io.to(`user:${id}`).emit(event, payload);
}

export function emitToAdmins(event, payload) {
  io?.to('admins').emit(event, payload);
}

/** Ends live connections for an account, for example when a rider is deactivated. */
export function disconnectUser(userId) {
  io?.in(`user:${idOf(userId)}`).disconnectSockets(true);
}

/** Tells everyone involved in an order that it changed. Call only after saving. */
export function publishOrderChange(order, event = 'order:updated') {
  const payload = { orderId: idOf(order), orderNumber: order.orderNumber, status: order.status };
  emitToUsers([order.customer, order.currentRider], event, payload);
  emitToAdmins(event, payload);
}

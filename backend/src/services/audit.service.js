import { AuditLog } from '../models/AuditLog.js';

/**
 * Records an important action. Inside a transaction a failure undoes the whole
 * action. Outside one, a failure is logged so it never blocks the person's request.
 */
export async function recordAudit({ actor, action, entityType, entityId, metadata, req, session }) {
  const entry = {
    actor: actor?._id,
    actorRole: actor?.role,
    action,
    entityType,
    entityId,
    metadata,
    ipAddress: req?.ip,
  };

  if (session) {
    try {
      await AuditLog.create([entry], { session });
    } catch (error) {
      console.error(`Could not write audit log for ${action} in session: ${error.message}`);
    }
    return;
  }

  try {
    await AuditLog.create(entry);
  } catch (error) {
    console.error(`Could not write audit log for ${action}: ${error.message}`);
  }
}

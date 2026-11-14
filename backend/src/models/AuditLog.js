import mongoose, { Schema } from 'mongoose';
import { AUDIT_ACTION, ROLES } from '../config/constants.js';
import { appendOnly } from './shared/appendOnly.js';

// Permanent record of who did what, and when. Never store passwords or tokens here.
const auditLogSchema = new Schema(
  {
    // Empty when nobody is logged in, such as a failed login.
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, enum: Object.values(ROLES) },
    action: { type: String, enum: Object.values(AUDIT_ACTION), required: true },
    entityType: { type: String, trim: true, maxlength: 60 },
    entityId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

auditLogSchema.plugin(appendOnly);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

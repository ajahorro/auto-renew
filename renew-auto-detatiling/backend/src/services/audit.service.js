const prisma = require("../config/prisma");

/**
 * Creates an audit log entry.
 * Supports being part of a Prisma transaction.
 */
const logAction = async (txOrPrisma, {
  userId,
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
  details = null,
  bookingId = null,
  metadata = {},
  ipAddress = null,
  userAgent = null
}) => {
  const client = txOrPrisma || prisma;
  
  try {
    return await client.auditLog.create({
      data: {
        userId: userId ? String(userId) : null,
        action,
        entityType,
        entityId: String(entityId),
        // Ensure these are objects for jsonb columns, or strings if the client is old
        oldValue: oldValue || null,
        newValue: newValue || null,
        details,
        bookingId: bookingId ? Number(bookingId) : null,
        performedBy: userId ? String(userId) : "SYSTEM",
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    console.error("CRITICAL ERROR [AUDIT_LOG_SERVICE]:", error);
    // Silent fail to prevent breaking the parent transaction flow
  }
};

/**
 * Legacy wrapper for non-transactional calls
 */
const createAuditLog = async (params) => {
  return await logAction(prisma, params);
};

module.exports = {
  logAction,
  createAuditLog
};

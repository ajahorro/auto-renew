const prisma = require("../config/prisma");

/**
 * Creates an audit log entry
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - The action performed (e.g., 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE')
 * @param {string} entityType - The type of entity being acted upon (e.g., 'Booking', 'Payment')
 * @param {string|number} entityId - The ID of the entity
 * @param {object} oldValue - The state before the change (optional)
 * @param {object} newValue - The state after the change (optional)
 * @param {string} details - Additional human-readable details
 * @param {string} bookingId - Associated booking ID if applicable
 */
const createAuditLog = async ({
  userId,
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
  details = null,
  bookingId = null
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ? String(userId) : null,
        action,
        entityType,
        entityId: String(entityId),
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        details,
        bookingId: bookingId ? Number(bookingId) : null,
        performedBy: userId ? String(userId) : "SYSTEM"
      }
    });
  } catch (error) {
    console.error("CRITICAL ERROR [CREATE_AUDIT_LOG]:", error);
    // We don't throw here to avoid breaking the main flow if audit logging fails
  }
};

module.exports = {
  createAuditLog
};

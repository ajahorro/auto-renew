const prisma = require("../config/prisma");
const emailService = require("./email.service");
const crypto = require("crypto");

/**
 * Notification Queue Service
 * 
 * IDEMPOTENCY: DB-enforced via unique constraint on idempotencyKey column.
 * - NO pre-check queries before insert
 * - NO post-insert dedup sweeps
 * - DB unique constraint is the ONLY gatekeeper
 * - P2002 (unique violation) = duplicate event → safely ignored
 */
class NotificationQueueService {
  /**
   * Generate idempotency key from exact event trigger.
   * Key = hash(eventType + entityId + eventUniqueIdentifier)
   * 
   * eventUniqueIdentifier MUST represent the exact event:
   * - paymentId (for payment events)
   * - auditLogId (for state changes)
   * - refundId (for refunds)
   */
  _generateIdempotencyKey(type, entityId, eventUniqueId) {
    const raw = `${type}:${entityId || ""}:${eventUniqueId || ""}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
  }

  /**
   * Queue a notification.
   * 
   * ATOMIC: Single insert. DB unique constraint handles deduplication.
   * No pre-check. No sweep. No race conditions.
   */
  async queue(params) {
    const { userId, title, message, type, channels = ["EMAIL"], metadata = {}, entityId, eventUniqueId } = params;

    const uniqueId = eventUniqueId || `${userId}-${Date.now()}`;
    const idempotencyKey = this._generateIdempotencyKey(type, entityId || userId, uniqueId);

    try {
      // ATOMIC INSERT — DB unique constraint is the single gatekeeper
      return await prisma.notificationQueue.create({
        data: {
          userId,
          title,
          message,
          type,
          channels,
          status: "PENDING",
          metadata,
          idempotencyKey
        }
      });
    } catch (error) {
      // P2002 = unique constraint violation → duplicate event, safely ignore
      if (error?.code === "P2002") {
        return null;
      }

      // P2009/P2022 = idempotencyKey column doesn't exist yet (migration pending)
      // Fallback: insert without idempotencyKey, use metadata for traceability only
      if (error?.code === "P2009" || error?.code === "P2022") {
        return await prisma.notificationQueue.create({
          data: {
            userId, title, message, type, channels,
            status: "PENDING",
            metadata: { ...metadata, _idempotencyKey: idempotencyKey }
          }
        });
      }

      throw error;
    }
  }

  /**
   * Process the queue (called by cron).
   */
  async processQueue() {
    try {
      const pending = await prisma.notificationQueue.findMany({
        where: {
          status: { in: ["PENDING", "FAILED"] },
          attempts: { lt: 5 },
          OR: [
            { nextRetry: null },
            { nextRetry: { lte: new Date() } }
          ]
        },
        take: 20
      });

      for (const item of pending) {
        await this.dispatch(item);
      }
    } catch (error) {
      if (error?.code === "P2021" && error?.meta?.table?.includes("NotificationQueue")) {
        console.log("[NotificationQueue] Skipping - table not yet created");
      } else {
        throw error;
      }
    }
  }

  /**
   * Dispatch a notification.
   */
  async dispatch(item) {
    let success = true;
    let errors = [];

    try {
      const user = await prisma.user.findUnique({ where: { id: item.userId } });
      if (!user) throw new Error("User not found");

      for (const channel of item.channels) {
        try {
          if (channel === "EMAIL" && user.email) {
            await emailService.sendEmail({
              to: user.email,
              subject: item.title,
              text: item.message,
              html: `<p>${item.message}</p>`
            });
          }
        } catch (err) {
          success = false;
          errors.push(`${channel}: ${err.message}`);
        }
      }

      if (success) {
        // Create in-app notification from outbox (single notification source)
        // Controller writes only to outbox; worker creates both email + in-app notification.
        try {
          await prisma.notification.create({
            data: {
              userId: item.userId, title: item.title, message: item.message,
              type: item.type, actionType: item.metadata?.actionType || null,
              actorId: item.metadata?.actorId || null, actorName: item.metadata?.actorName || null,
              targetId: item.metadata?.targetId || null, targetName: item.metadata?.targetName || null
            }
          });
        } catch (e) { console.error("[NOTIFICATION_QUEUE] In-app notification create failed:", e); }

        await prisma.notificationQueue.update({
          where: { id: item.id },
          data: { status: "SENT", updatedAt: new Date() }
        });
      } else {
        const nextAttempt = item.attempts + 1;
        await prisma.notificationQueue.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            attempts: nextAttempt,
            lastError: errors.join("; "),
            nextRetry: new Date(Date.now() + Math.pow(2, nextAttempt) * 60000),
            updatedAt: new Date()
          }
        });
      }
    } catch (err) {
      console.error(`[NOTIFICATION_QUEUE] Fatal error for item ${item.id}:`, err);
    }
  }
}

module.exports = new NotificationQueueService();

const prisma = require("../config/prisma");
const { sendEmail } = require("./email.service");

async function sendSms(destination, message) {
  const settings = await prisma.businessSettings.findFirst();
  if (!settings?.smsApiUrl) {
    return {
      success: false,
      error: "SMS provider is not configured"
    };
  }

  const response = await fetch(settings.smsApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": settings.smsApiKey ? `Bearer ${settings.smsApiKey}` : undefined
    },
    body: JSON.stringify({
      to: destination,
      senderId: settings.smsSenderId || undefined,
      message
    })
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      success: false,
      error: `SMS provider returned ${response.status}: ${body}`
    };
  }

  const data = await response.json().catch(() => ({}));
  return {
    success: true,
    messageId: data?.messageId || data?.id || null
  };
}

async function enqueueDispatches(user, notification, data, tx) {
  const settings = await tx.businessSettings.findFirst();
  const maxAttempts = settings?.notificationRetryLimit || 3;
  const dispatches = [];

  if (user.notifyWeb !== false) {
    dispatches.push({
      notificationId: notification?.id || null,
      recipientUserId: user.id,
      channel: "WEB",
      type: data.type || "GENERAL",
      status: "SENT",
      destination: user.id,
      payload: { title: data.title, message: data.message },
      maxAttempts,
      attemptCount: 1,
      deliveredAt: new Date(),
      lastAttemptAt: new Date()
    });
  }

  if (user.notifyEmail !== false && user.email) {
    dispatches.push({
      notificationId: notification?.id || null,
      recipientUserId: user.id,
      channel: "EMAIL",
      type: data.type || "GENERAL",
      status: "PENDING",
      destination: user.email,
      subject: `[RENEW Auto Detailing] ${data.title}`,
      payload: { html: data.emailHtml, text: data.message },
      maxAttempts
    });
  }

  if (data.enableSms && user.phone) {
    dispatches.push({
      notificationId: notification?.id || null,
      recipientUserId: user.id,
      channel: "SMS",
      type: data.type || "GENERAL",
      status: "PENDING",
      destination: user.phone,
      payload: { message: data.smsMessage || data.message },
      maxAttempts
    });
  }

  if (dispatches.length === 0) {
    return [];
  }

  const created = [];
  for (const dispatch of dispatches) {
    created.push(await tx.notificationDispatch.create({ data: dispatch }));
  }

  return created;
}

async function dispatchNotification(notificationDispatchId) {
  const dispatch = await prisma.notificationDispatch.findUnique({
    where: { id: notificationDispatchId }
  });

  if (!dispatch || dispatch.status === "SENT") {
    return dispatch;
  }

  let result;
  if (dispatch.channel === "EMAIL") {
    const payload = dispatch.payload || {};
    result = await sendEmail(dispatch.destination, dispatch.subject || "[RENEW Auto Detailing]", payload.html || `<p>${payload.text || ""}</p>`);
  } else if (dispatch.channel === "SMS") {
    result = await sendSms(dispatch.destination, dispatch.payload?.message || "");
  } else {
    result = { success: true };
  }

  const now = new Date();
  const nextAttemptCount = dispatch.attemptCount + 1;
  const exceeded = nextAttemptCount >= dispatch.maxAttempts;

  return prisma.notificationDispatch.update({
    where: { id: dispatch.id },
    data: result.success ? {
      status: "SENT",
      deliveredAt: now,
      lastAttemptAt: now,
      attemptCount: nextAttemptCount,
      failureReason: null,
      providerMessageId: result.messageId || null
    } : {
      status: exceeded ? "FAILED" : "RETRYING",
      attemptCount: nextAttemptCount,
      lastAttemptAt: now,
      nextRetryAt: exceeded ? null : new Date(now.getTime() + 5 * 60 * 1000),
      failureReason: result.error || "Notification dispatch failed"
    }
  });
}

async function processPendingNotifications() {
  const pending = await prisma.notificationDispatch.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: 50
  });

  for (const dispatch of pending) {
    await dispatchNotification(dispatch.id);
  }

  return pending.length;
}

async function createNotification(userId, data, tx = null) {
  const db = tx || prisma;
  const user = await db.user.findUnique({
    where: { id: String(userId) },
    select: {
      id: true,
      email: true,
      phone: true,
      notifyEmail: true,
      notifyWeb: true
    }
  });

  if (!user) {
    return null;
  }

  const notification = await db.notification.create({
    data: {
      userId: user.id,
      title: data.title,
      message: data.message,
      type: data.type || "GENERAL",
      relatedId: data.relatedId || null,
      actionType: data.actionType || null,
      targetId: data.targetId || null,
      targetName: data.targetName || null,
      actorId: data.actorId || null,
      actorName: data.actorName || null
    }
  });

  const dispatches = await enqueueDispatches(user, notification, data, db);

  if (!tx) {
    for (const dispatch of dispatches.filter((entry) => entry.status !== "SENT")) {
      dispatchNotification(dispatch.id).catch((error) => {
        console.error("Notification dispatch error:", error);
      });
    }
  }

  return notification;
}

async function notifyAdmins(data, tx = null) {
  const db = tx || prisma;
  const admins = await db.user.findMany({
    where: {
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      isActive: true
    },
    select: { id: true }
  });

  const notifications = [];
  for (const admin of admins) {
    notifications.push(await createNotification(admin.id, {
      ...data,
      enableSms: data.enableSms ?? true
    }, tx));
  }

  return notifications;
}

async function notifyAdminsBookingUpdated(bookingId, title, message, actorId, actorName) {
  return notifyAdmins({
    title,
    message,
    type: "BOOKING",
    actionType: "BOOKING_UPDATED",
    actorId: actorId || null,
    actorName: actorName || null,
    targetId: String(bookingId),
    targetName: `Booking #${bookingId}`,
    enableSms: true
  });
}

module.exports = {
  createNotification,
  notifyAdmins,
  notifyAdminsBookingUpdated,
  processPendingNotifications,
  dispatchNotification
};

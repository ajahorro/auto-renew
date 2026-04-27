const {
  createPayment,
  reviewPayment,
  getPayments,
  getPaymentDashboard
} = require("../services/payment.service");

function respondError(res, error) {
  const message = error.message || "Internal Server Error";
  const status = /not found/i.test(message) ? 404
    : /unauthorized|only|cannot|invalid|required|must/i.test(message) ? 400
      : 500;
  return res.status(status).json({
    success: false,
    message
  });
}

async function createPaymentReceipt(req, res) {
  try {
    const result = await createPayment({
      bookingId: req.body.bookingId,
      method: req.body.method,
      paymentType: req.body.paymentType,
      amount: req.body.amount,
      referenceNumber: req.body.referenceNumber,
      file: req.file
    }, req.user);

    return res.status(201).json({
      success: true,
      payment: result.payment,
      booking: result.booking
    });
  } catch (error) {
    return respondError(res, error);
  }
}

async function verifyPayment(req, res) {
  try {
    const result = await reviewPayment(req.params.id, req.body.action, req.user, req.body.rejectionReason);
    return res.json({
      success: true,
      payment: result.payment,
      booking: result.booking
    });
  } catch (error) {
    return respondError(res, error);
  }
}

async function createManualPayment(req, res) {
  try {
    const result = await createPayment({
      bookingId: req.body.bookingId,
      method: req.body.method || "CASH",
      paymentType: req.body.paymentType || "FULL",
      amount: req.body.amount
    }, req.user);

    return res.status(201).json({
      success: true,
      payment: result.payment,
      booking: result.booking
    });
  } catch (error) {
    return respondError(res, error);
  }
}

async function listPayments(req, res) {
  try {
    const payments = await getPayments(req.query, req.user);
    return res.json({
      success: true,
      payments
    });
  } catch (error) {
    return respondError(res, error);
  }
}

async function listPendingVerification(req, res) {
  try {
    const payments = await getPayments({
      ...req.query,
      status: "FOR_VERIFICATION"
    }, req.user);
    return res.json({
      success: true,
      payments
    });
  } catch (error) {
    return respondError(res, error);
  }
}

async function getAdminPaymentAnalytics(req, res) {
  try {
    const analytics = await getPaymentDashboard({
      from: req.query.from,
      to: req.query.to
    });
    return res.json({
      success: true,
      analytics
    });
  } catch (error) {
    return respondError(res, error);
  }
}

module.exports = {
  createPaymentReceipt,
  verifyPayment,
  createManualPayment,
  listPayments,
  listPendingVerification,
  getAdminPaymentAnalytics
};

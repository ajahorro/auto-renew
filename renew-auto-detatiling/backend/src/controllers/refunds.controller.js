const {
  calculateRefundAmount,
  requestRefund,
  processRefund,
  listRefunds
} = require("../services/refund.service");

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

async function GET_PENDING_REFUNDS(req, res) {
  try {
    const refunds = await listRefunds("PENDING");
    return res.json({ success: true, refunds });
  } catch (error) {
    return respondError(res, error);
  }
}

async function PROCESS_REFUND(req, res) {
  try {
    const refund = await processRefund(req.params.id || req.body.refundId, req.user, req.body.notes);
    return res.json({ success: true, refund });
  } catch (error) {
    return respondError(res, error);
  }
}

async function GET_REFUND_HISTORY(req, res) {
  try {
    const refunds = await listRefunds();
    return res.json({ success: true, refunds });
  } catch (error) {
    return respondError(res, error);
  }
}

async function GET_REFUND_CALCULATION(req, res) {
  try {
    const calculation = await calculateRefundAmount(req.params.bookingId);
    return res.json({ success: true, calculation });
  } catch (error) {
    return respondError(res, error);
  }
}

async function CREATE_REFUND(req, res) {
  try {
    const refund = await requestRefund(req.body.bookingId, req.user, req.body.reason);
    return res.status(201).json({ success: true, refund });
  } catch (error) {
    return respondError(res, error);
  }
}

module.exports = {
  GET_PENDING_REFUNDS,
  PROCESS_REFUND,
  GET_REFUND_HISTORY,
  GET_REFUND_CALCULATION,
  CREATE_REFUND
};

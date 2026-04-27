const {
  updateServiceStatus,
  getBookingTimeline
} = require("../services/booking-operations.service");

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

async function patchServiceStatus(req, res) {
  try {
    const booking = await updateServiceStatus(
      req.params.id,
      req.body.serviceStatus,
      req.user,
      req.body.overrideReason || null
    );

    return res.json({
      success: true,
      booking
    });
  } catch (error) {
    return respondError(res, error);
  }
}

async function adminCompleteWithOverride(req, res) {
  try {
    if (!req.body.reason || !String(req.body.reason).trim()) {
      return res.status(400).json({
        success: false,
        message: "Override reason is required"
      });
    }

    const booking = await updateServiceStatus(
      req.params.id,
      "COMPLETED",
      req.user,
      String(req.body.reason).trim()
    );

    return res.json({
      success: true,
      booking
    });
  } catch (error) {
    return respondError(res, error);
  }
}

async function bookingTimeline(req, res) {
  try {
    const timeline = await getBookingTimeline(req.params.id, req.user);
    return res.json({
      success: true,
      ...timeline
    });
  } catch (error) {
    return respondError(res, error);
  }
}

module.exports = {
  patchServiceStatus,
  adminCompleteWithOverride,
  bookingTimeline
};

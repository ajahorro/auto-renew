const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");
const {
  GET_PENDING_REFUNDS,
  PROCESS_REFUND,
  GET_REFUND_HISTORY,
  GET_REFUND_CALCULATION
} = require("../controllers/refunds.controller");

router.get("/pending", authenticate, authorize("ADMIN", "SUPER_ADMIN"), GET_PENDING_REFUNDS);

router.get("/history", authenticate, authorize("ADMIN", "SUPER_ADMIN"), GET_REFUND_HISTORY);

router.get("/:bookingId", authenticate, GET_REFUND_CALCULATION);

router.patch("/process", authenticate, authorize("ADMIN", "SUPER_ADMIN"), PROCESS_REFUND);

module.exports = router;

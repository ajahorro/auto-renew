const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");
const {
  GET_PENDING_REFUNDS,
  PROCESS_REFUND,
  GET_REFUND_HISTORY,
  GET_REFUND_CALCULATION,
  CREATE_REFUND
} = require("../controllers/refunds.controller");

router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CUSTOMER"), CREATE_REFUND);

router.get("/pending", authenticate, authorize("ADMIN", "SUPER_ADMIN"), GET_PENDING_REFUNDS);

router.get("/history", authenticate, authorize("ADMIN", "SUPER_ADMIN"), GET_REFUND_HISTORY);

router.get("/:bookingId", authenticate, GET_REFUND_CALCULATION);

router.patch("/:id/process", authenticate, authorize("ADMIN", "SUPER_ADMIN"), PROCESS_REFUND);

module.exports = router;

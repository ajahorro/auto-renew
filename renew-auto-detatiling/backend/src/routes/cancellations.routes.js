const express = require("express");
const router = express.Router();


const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");
const {
  REQUEST_CANCELLATION,
  APPROVE_CANCELLATION,
  REJECT_CANCELLATION,
  GET_CANCELLATION_REQUESTS,
  GET_CANCELLATION_BY_ID
} = require("../controllers/cancellations.controller");

router.post("/request", authenticate, REQUEST_CANCELLATION);

router.get("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), GET_CANCELLATION_REQUESTS);

router.get("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), GET_CANCELLATION_BY_ID);

router.patch("/:id/approve", authenticate, authorize("ADMIN", "SUPER_ADMIN"), APPROVE_CANCELLATION);

router.patch("/:id/reject", authenticate, authorize("ADMIN", "SUPER_ADMIN"), REJECT_CANCELLATION);

module.exports = router;

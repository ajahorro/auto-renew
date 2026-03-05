const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth.middleware");

const {
  getNotifications,
  markNotificationRead
} = require("../controllers/notifications.controller");

router.get(
  "/",
  authenticate,
  getNotifications
);

router.patch(
  "/:id/read",
  authenticate,
  markNotificationRead
);

module.exports = router;
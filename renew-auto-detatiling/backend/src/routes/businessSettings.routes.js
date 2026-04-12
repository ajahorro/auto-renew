const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");

const controller = require("../controllers/businessSettings.controller");

/* GET BUSINESS SETTINGS - Public (no auth required) */

router.get(
  "/",
  controller.getSettings
);

/* UPDATE BUSINESS SETTINGS */

router.patch(
  "/",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  controller.updateSettings
);

module.exports = router;
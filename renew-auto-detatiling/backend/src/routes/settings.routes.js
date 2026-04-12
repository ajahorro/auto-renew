const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");

const settingsController = require("../controllers/settings.controller");

/* =========================
   GET BUSINESS SETTINGS
========================= */

router.get(
  "/business",
  authenticate,
  settingsController.getBusinessSettings
);

/* =========================
   UPDATE BUSINESS SETTINGS
========================= */

router.patch(
  "/business",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  settingsController.updateBusinessSettings
);

module.exports = router;
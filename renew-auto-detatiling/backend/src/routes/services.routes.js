const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");
const servicesController = require("../controllers/services.controller");

// Public list
router.get("/", servicesController.getServices);

// Admin create
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), servicesController.createService);

module.exports = router;
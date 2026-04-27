const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");

const multer = require("multer");
const path = require("path");
const controller = require("../controllers/businessSettings.controller");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `gcash-qr-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

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
  upload.single("gcashQR"),
  controller.updateSettings
);

module.exports = router;

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");
const {
  createPaymentReceipt,
  verifyPayment,
  createManualPayment,
  listPayments,
  listPendingVerification,
  getAdminPaymentAnalytics
} = require("../controllers/payment.controller");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `receipt-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = new Set([".jpeg", ".jpg", ".png", ".pdf"]);
    const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);
    const extname = allowedExtensions.has(extension);
    const mimetype = allowedMimeTypes.has(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png) and PDF are allowed"));
  }
});

router.get("/analytics", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getAdminPaymentAnalytics);

router.post("/", authenticate, upload.single("receipt"), createPaymentReceipt);

router.get("/", authenticate, listPayments);

router.get("/pending", authenticate, authorize("ADMIN", "SUPER_ADMIN"), listPendingVerification);

router.patch("/:id/verify", authenticate, authorize("ADMIN", "SUPER_ADMIN"), verifyPayment);

router.post("/manual", authenticate, authorize("ADMIN", "SUPER_ADMIN", "STAFF"), createManualPayment);

module.exports = router;

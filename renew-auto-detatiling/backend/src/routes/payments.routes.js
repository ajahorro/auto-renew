const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");
const {
  createPayment,
  verifyPayment,
  createManualPayment,
  getPayments,
  getPendingVerifications,
  bulkVerifyPayments
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
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png) and PDF are allowed"));
  }
});

router.post("/", authenticate, upload.single("receipt"), createPayment);

router.get("/", authenticate, getPayments);

router.get("/pending", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getPendingVerifications);

router.patch("/:id/verify", authenticate, authorize("ADMIN", "SUPER_ADMIN"), verifyPayment);

router.post("/bulk-verify", authenticate, authorize("ADMIN", "SUPER_ADMIN"), bulkVerifyPayments);

router.post("/manual", authenticate, authorize("ADMIN", "SUPER_ADMIN"), createManualPayment);

module.exports = router;

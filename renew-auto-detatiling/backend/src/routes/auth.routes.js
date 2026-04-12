const express = require("express");

const router = express.Router();

const authController = require("../controllers/auth.controller");

/* ===============================
   REGISTER CUSTOMER
=============================== */

router.post(
  "/register",
  authController.registerCustomer
);

/* ===============================
   LOGIN
=============================== */

router.post(
  "/login",
  authController.login
);

/* ===============================
   FORGOT PASSWORD
=============================== */

router.post(
  "/forgot-password",
  authController.forgotPassword
);

/* ===============================
   RESET PASSWORD
 =============================== */

router.post(
  "/reset-password",
  authController.resetPassword
);

/* ===============================
   SEND EMAIL OTP
 =============================== */

router.post(
  "/send-email-otp",
  authController.sendEmailOtp
);

/* ===============================
   VERIFY EMAIL OTP
 =============================== */

router.post(
  "/verify-email-otp",
  authController.verifyEmailOtp
);

module.exports = router;
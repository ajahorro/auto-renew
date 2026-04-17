const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

router.post("/register/initiate", authController.initiateRegistration);
router.post("/register/verify-otp", authController.verifyRegistrationOtp);
router.post("/register/resend-otp", authController.resendRegistrationOtp);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/send-email-otp", authController.sendEmailOtp);
router.post("/verify-email-otp", authController.verifyEmailOtp);

module.exports = router;
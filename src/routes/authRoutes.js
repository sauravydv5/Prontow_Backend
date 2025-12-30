import express from "express";
import { sendOtp, verifyOtp, adminForgotPassword } from "../controllers/authController.js";
import { loginAdminValidation, adminForgotPasswordValidation } from "../validators/auth.validation.js";
import  requestValidator  from "../middleware/requestValidator.js";
import { loginAdmin } from "../controllers/authController.js";


const router = express.Router();

router.post("/login", sendOtp);
router.post("/login/admin", loginAdminValidation, requestValidator, loginAdmin);
router.post("/otp/verify", verifyOtp);
router.post("/admin/forgot-password", adminForgotPasswordValidation, requestValidator, adminForgotPassword);

export default router;

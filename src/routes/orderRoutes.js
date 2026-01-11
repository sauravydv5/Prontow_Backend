import express from "express";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  getAllOrdersForAdmin,
  verifyPayment,
  razorpayWebhook,
  getOrderHistory,
  getOrderTracking,
  cancelOrder,
  updateOrderStatus,
} from "../controllers/orderController.js";

import { myCurrentMatch } from "../controllers/myCurrentMatchcontroller.js";

import protect, { adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ===================== WEBHOOK ===================== */
router.post("/webhook/razorpay", razorpayWebhook);

/* ===================== CREATE / PAYMENT ===================== */
router.post("/", protect, createOrder);
router.post("/verify-payment", protect, verifyPayment);

/* ===================== ADMIN ===================== */
router.get("/admin", protect, adminOnly, getAllOrdersForAdmin);
router.put("/admin/:id/status", protect, adminOnly, updateOrderStatus);

/* ===================== MY CURRENT MATCH ===================== */
router.get("/my-current-match", protect, myCurrentMatch);

/* ===================== HISTORY / TRACKING ===================== */
router.get("/history", protect, getOrderHistory);
router.get("/tracking/:id", protect, getOrderTracking);

/* ===================== USER ===================== */
router.get("/", protect, getUserOrders);
router.post("/:id/cancel", protect, cancelOrder);
router.get("/:id", protect, getOrderById);

export default router;

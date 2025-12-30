import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getWallet,
  addMoney,
  deductMoney
} from "../controllers/walletController.js";

const router = express.Router();

router.get("/", protect, getWallet);

router.post("/add", protect, addMoney);

router.post("/deduct", protect, deductMoney);

export default router;

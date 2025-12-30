import mongoose from "mongoose";
import Wallet from "../models/wallet.js";
import User from "../models/user.js";
import responseHandler from "../utils/responseHandler.js";


export const getWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch wallet or auto-create if missing (first-time user)
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: userId });
    }

    // Sort transactions (latest first)
    wallet.transactions.sort((a, b) => b.createdAt - a.createdAt);

    return res
      .status(200)
      .json(responseHandler.success(wallet, "Wallet fetched successfully"));
  } catch (err) {
    return res
      .status(500)
      .json(responseHandler.error(err.message || "Server error"));
  }
};

/**
 * 💰 Add Money to Wallet (CREDIT)
 */
export const addMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json(responseHandler.error("Amount must be greater than 0"));
    }

    // Fetch or create wallet
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: userId, balance: 0, transactions: [] });
    }

    const txnRef = new mongoose.Types.ObjectId(); // unique transaction reference

    // Update wallet balance & log transaction
    wallet.balance += amount;
    wallet.transactions.unshift({
      _id: txnRef,
      type: "CREDIT",
      amount,
      description: description || "Wallet top-up",
      createdAt: new Date(),
    });

    await wallet.save();

    // Update user's game tokens
    await User.findByIdAndUpdate(userId, { $inc: { gameTokens: amount } });

    return res
      .status(200)
      .json(
        responseHandler.success(
          { balance: wallet.balance, txnRef },
          "Money credited successfully"
        )
      );
  } catch (err) {
    return res
      .status(500)
      .json(responseHandler.error(err.message || "Server error"));
  }
};

/**
 * 💸 Deduct Money from Wallet (DEBIT)
 */
export const deductMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, description, orderId } = req.body;

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json(responseHandler.error("Amount must be greater than 0"));
    }

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res
        .status(404)
        .json(responseHandler.error("Wallet not found for this user"));
    }

    if (wallet.balance < amount) {
      return res
        .status(400)
        .json(responseHandler.error("Insufficient wallet balance"));
    }

    const txnRef = new mongoose.Types.ObjectId();

    // Deduct and record transaction
    wallet.balance -= amount;
    wallet.transactions.unshift({
      _id: txnRef,
      type: "DEBIT",
      amount,
      description: description || "Wallet payment",
      orderId: orderId || null,
      createdAt: new Date(),
    });

    await wallet.save();

    return res
      .status(200)
      .json(
        responseHandler.success(
          { balance: wallet.balance, txnRef },
          "Money debited successfully"
        )
      );
  } catch (err) {
    return res
      .status(500)
      .json(responseHandler.error(err.message || "Server error"));
  }
};


